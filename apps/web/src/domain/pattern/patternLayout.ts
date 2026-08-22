import type { PatternConfig, UUID } from '@odyssey/schemas'

export interface PatternPresentation {
  readonly slots: readonly {
    readonly slotId: UUID
    readonly x: number
    readonly y: number
    readonly labelPlacement?: 'top' | 'right' | 'bottom' | 'left'
  }[]
  readonly routes: readonly {
    readonly routeId: UUID
    readonly sourceSlotId: UUID
    readonly targetSlotId: UUID | null
  }[]
}

const CENTER_X = 360
const CENTER_Y = 210
const HUB_SPOKE_RADIUS_X = 280
const HUB_SPOKE_RADIUS_Y = 180

function hubSpokeAngle(index: number, count: number): number {
  if (count === 1) return 0
  if (count === 2) return index === 0 ? Math.PI : 0
  if (count === 3) return [-Math.PI / 2, 5 * Math.PI / 6, Math.PI / 6][index] ?? 0
  return -Math.PI / 2 + index * 2 * Math.PI / count
}

function hubSpokeLabelPlacement(angle: number, index: number, count: number): 'top' | 'bottom' {
  if (count === 1) return 'top'
  if (count === 2) return index === 0 ? 'bottom' : 'top'
  const verticalDirection = Math.sin(angle)
  if (verticalDirection < -0.2) return 'top'
  if (verticalDirection > 0.2) return 'bottom'
  return Math.cos(angle) < 0 ? 'bottom' : 'top'
}

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
      ...(hub ? [{ slotId: hub.id, x: CENTER_X, y: CENTER_Y, labelPlacement: 'bottom' as const }] : []),
      ...spokes.map((slot, index) => {
        const angle = hubSpokeAngle(index, spokes.length)
        return {
          slotId: slot.id,
          x: Math.round(CENTER_X + Math.cos(angle) * HUB_SPOKE_RADIUS_X),
          y: Math.round(CENTER_Y + Math.sin(angle) * HUB_SPOKE_RADIUS_Y),
          labelPlacement: hubSpokeLabelPlacement(angle, index, spokes.length),
        }
      }),
    ]
  } else {
    const ordered = [...pattern.slots].sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    slots = ordered.map((slot, index) => {
      const angle = Math.PI + index * 2 * Math.PI / ordered.length
      return { slotId: slot.id, x: CENTER_X + Math.cos(angle) * 190, y: CENTER_Y + Math.sin(angle) * 130 }
    })
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
