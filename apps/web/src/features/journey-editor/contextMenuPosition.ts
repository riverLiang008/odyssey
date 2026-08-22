import type { MenuAnchor } from '@/canvas/interaction'

interface AnchorRect {
  left: number
  right: number
  top: number
}

interface ViewportSize {
  width: number
  height: number
}

const MENU_WIDTH = 194
const MENU_HEIGHT = 90
const MENU_GAP = 8
const VIEWPORT_MARGIN = 12

export function positionMenuBeside(rect: AnchorRect, viewport: ViewportSize): MenuAnchor {
  const right = rect.right + MENU_GAP
  const left = rect.left - MENU_GAP - MENU_WIDTH
  const x = right + MENU_WIDTH <= viewport.width - VIEWPORT_MARGIN
    ? right
    : Math.max(VIEWPORT_MARGIN, left)
  const maxY = Math.max(VIEWPORT_MARGIN, viewport.height - VIEWPORT_MARGIN - MENU_HEIGHT)
  return {
    x,
    y: Math.min(Math.max(VIEWPORT_MARGIN, rect.top), maxY),
  }
}
