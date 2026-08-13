import type { PatternConfig, UUID } from '@odyssey/schemas'

export interface PatternPresentation {
  readonly slots: readonly { readonly slotId: UUID; readonly x: number; readonly y: number }[]
  readonly routes: readonly {
    readonly routeId: UUID
    readonly sourceSlotId: UUID
    readonly targetSlotId: UUID | null
  }[]
}

const CENTER_X = 360
const CENTER_Y = 210

export function derivePatternPresentation(pattern: PatternConfig): PatternPresentation {
  let slots: PatternPresentation['slots']
  if (pattern.kind === 'solo_component') {
    slots = pattern.slots.map((slot) => ({ slotId: slot.id, x: CENTER_X, y: CENTER_Y }))
  } else if (pattern.kind === 'linear_sequence') {
    const ordered = [...pattern.slots].sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    const gap = ordered.length === 1 ? 0 : Math.min(160, 560 / (ordered.length - 1))
    const startX = CENTER_X - gap * (ordered.length - 1) / 2
    slots = ordered.map((slot, index) => ({ slotId: slot.id, x: startX + index * gap, y: CENTER_Y }))
  } else if (pattern.kind === 'hub_and_spoke') {
    const hub = pattern.slots.find((slot) => slot.topologyRole === 'hub')
    const spokes = pattern.slots.filter((slot) => slot.topologyRole === 'spoke')
    slots = [
      ...(hub ? [{ slotId: hub.id, x: CENTER_X, y: CENTER_Y }] : []),
      ...spokes.map((slot, index) => {
        const angle = -Math.PI / 2 + index * 2 * Math.PI / spokes.length
        return { slotId: slot.id, x: CENTER_X + Math.cos(angle) * 150, y: CENTER_Y + Math.sin(angle) * 130 }
      }),
    ]
  } else {
    const positions: Record<string, { x: number; y: number }> = {
      entry: { x: 160, y: CENTER_Y },
      upper_branch: { x: CENTER_X, y: 80 },
      exit: { x: 560, y: CENTER_Y },
      lower_branch: { x: CENTER_X, y: 340 },
    }
    slots = pattern.slots.map((slot) => ({ slotId: slot.id, ...(positions[slot.topologyRole ?? ''] ?? { x: CENTER_X, y: CENTER_Y }) }))
  }

  return {
    slots,
    routes: pattern.routes.map((route) => ({
      routeId: route.id,
      sourceSlotId: route.sourceSlotId,
      targetSlotId: route.target.type === 'slot' ? route.target.slotId : null,
    })),
  }
}

