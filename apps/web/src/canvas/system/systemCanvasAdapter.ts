import type { AgentSummary, JourneyEditorDocument, PatternKind, UUID } from '@odyssey/schemas'

import { derivePatternPresentation, PATTERN_DEFINITIONS } from '@/domain/pattern'
import type { PatternOperation } from '@/domain/pattern'

export interface CanvasPoint { readonly x: number; readonly y: number }
export interface CanvasBounds { readonly width: number; readonly height: number }
export const SYSTEM_PATTERN_BOUNDS: CanvasBounds = { width: 468, height: 280 }
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
  readonly isEntry?: boolean
  readonly labelPlacement?: 'top' | 'right' | 'bottom' | 'left'
  readonly canReorder: boolean
  readonly canAddSibling?: boolean
  readonly canRemove?: boolean
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
  readonly bounds?: CanvasBounds
  readonly diagnostics: readonly { code: 'AGENT_SUMMARY_MISSING' | 'SLOT_POSITION_MISSING' | 'ROUTE_ENDPOINT_MISSING'; id: UUID }[]
}

export function createSystemCanvasViewModel(
  document: Readonly<JourneyEditorDocument>,
  selectedSlotId: UUID | null,
  bounds: CanvasBounds = SYSTEM_PATTERN_BOUNDS,
): SystemCanvasViewModel {
  const presentation = derivePatternPresentation(document.pattern)
  const operations: readonly PatternOperation[] = PATTERN_DEFINITIONS[document.pattern.kind].supportedOperations
  const nodeRadius = 22
  const mapPoint = (point: CanvasPoint): CanvasPoint => ({
    x: 44 + (point.x / 720) * (bounds.width - 88),
    y: 40 + (point.y / 420) * (bounds.height - 80),
  })
  const presentationBySlotId = new Map(presentation.slots.map((slot) => [slot.slotId, slot]))
  const positions = new Map(presentation.slots.map((slot) => [slot.slotId, mapPoint({ x: slot.x, y: slot.y })]))
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
      isEntry: document.pattern.kind === 'diamond_loop' && slot.topologyRole === 'entry',
      labelPlacement: presentationBySlotId.get(slot.id)?.labelPlacement
        ?? ((document.pattern.kind === 'diamond_loop' && position.y < bounds.height / 2) ? 'top' : 'bottom'),
      canReorder: document.pattern.kind === 'linear_sequence' || document.pattern.kind === 'diamond_loop',
      canAddSibling: operations.includes('add_slot'),
      canRemove: operations.includes('remove_slot') && !(document.pattern.kind === 'hub_and_spoke' && slot.topologyRole === 'hub'),
    }
  })
  const slotById = new Map(slots.map((slot) => [slot.id, slot]))
  const routes = presentation.routes.flatMap<SystemCanvasRouteViewModel>((route) => {
    // A route without a target Slot represents the Pattern's hand-off to the
    // surrounding Journey. System Canvas only visualizes execution between Slots.
    if (route.targetSlotId === null) return []
    const source = slotById.get(route.sourceSlotId)
    const target = slotById.get(route.targetSlotId)
    if (!source || !target) {
      diagnostics.push({ code: 'ROUTE_ENDPOINT_MISSING', id: route.routeId })
      return []
    }
    return [{ id: route.routeId, sourceSlotId: route.sourceSlotId, targetSlotId: route.targetSlotId,
      source: anchorToward(source.position, target.position, nodeRadius),
      target: anchorToward(target.position, source.position, nodeRadius) }]
  })
  return { kind: document.pattern.kind, name: document.pattern.name, slots, routes, bounds, diagnostics }
}

function anchorToward(origin: CanvasPoint, destination: CanvasPoint, radius: number): CanvasPoint {
  const dx = destination.x - origin.x
  const dy = destination.y - origin.y
  const length = Math.hypot(dx, dy)
  return length === 0 ? origin : { x: origin.x + dx / length * radius, y: origin.y + dy / length * radius }
}
