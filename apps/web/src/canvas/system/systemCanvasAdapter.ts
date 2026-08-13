import type { AgentSummary, JourneyEditorDocument, PatternKind, UUID } from '@odyssey/schemas'

import { derivePatternPresentation } from '@/domain/pattern'

export interface CanvasPoint { readonly x: number; readonly y: number }
export interface SystemCanvasSlotViewModel {
  readonly id: UUID
  readonly label: string
  readonly topologyRole: string | null
  readonly order: number | null
  readonly position: CanvasPoint
  readonly agent: AgentSummary | null
  readonly assignment: 'empty' | 'configured' | 'missing-summary'
  readonly selected: boolean
  readonly canAssign: boolean
  readonly canReorder: boolean
}
export interface SystemCanvasRouteViewModel {
  readonly id: UUID
  readonly sourceSlotId: UUID
  readonly targetSlotId: UUID | null
  readonly source: CanvasPoint
  readonly target: CanvasPoint
}
export interface SystemCanvasViewModel {
  readonly kind: PatternKind
  readonly name: string
  readonly slots: readonly SystemCanvasSlotViewModel[]
  readonly routes: readonly SystemCanvasRouteViewModel[]
  readonly diagnostics: readonly { code: 'AGENT_SUMMARY_MISSING' | 'SLOT_POSITION_MISSING' | 'ROUTE_ENDPOINT_MISSING'; id: UUID }[]
}

export function createSystemCanvasViewModel(
  document: Readonly<JourneyEditorDocument>,
  selectedSlotId: UUID | null,
): SystemCanvasViewModel {
  const presentation = derivePatternPresentation(document.pattern)
  const positions = new Map(presentation.slots.map((slot) => [slot.slotId, { x: slot.x, y: slot.y }]))
  const agents = new Map(document.agents.map((agent) => [agent.id, agent]))
  const diagnostics: SystemCanvasViewModel['diagnostics'][number][] = []
  const slots = document.pattern.slots.map<SystemCanvasSlotViewModel>((slot, index) => {
    const derivedPosition = positions.get(slot.id)
    if (!derivedPosition) diagnostics.push({ code: 'SLOT_POSITION_MISSING', id: slot.id })
    const position = derivedPosition ?? { x: 80 + index * 90, y: 370 }
    const agent = slot.agentId ? agents.get(slot.agentId) ?? null : null
    if (slot.agentId && !agent) diagnostics.push({ code: 'AGENT_SUMMARY_MISSING', id: slot.agentId })
    return {
      id: slot.id, label: slot.label, topologyRole: slot.topologyRole, order: slot.order, position,
      agent, assignment: !slot.agentId ? 'empty' : agent ? 'configured' : 'missing-summary',
      selected: slot.id === selectedSlotId, canAssign: slot.agentId === null,
      canReorder: document.pattern.kind === 'linear_sequence',
    }
  })
  const slotById = new Map(slots.map((slot) => [slot.id, slot]))
  const routes = presentation.routes.flatMap<SystemCanvasRouteViewModel>((route) => {
    const source = slotById.get(route.sourceSlotId)
    const target = route.targetSlotId ? slotById.get(route.targetSlotId) : null
    if (!source || (route.targetSlotId && !target)) {
      diagnostics.push({ code: 'ROUTE_ENDPOINT_MISSING', id: route.routeId })
      return []
    }
    return [{ id: route.routeId, sourceSlotId: route.sourceSlotId, targetSlotId: route.targetSlotId,
      source: source.position, target: target?.position ?? { x: 700, y: 210 } }]
  })
  return { kind: document.pattern.kind, name: document.pattern.name, slots, routes, diagnostics }
}
