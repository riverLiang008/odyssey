import type { Node } from '@vue-flow/core'
import type { WorkflowCanvasNodeData } from './workflowCanvasAdapter'
import type { LoopChildSize } from './loopBounds'

/** View-only expansion also supports content beyond the stored resize limits. */
export function expandMeasuredLoopFrames(nodes: Node<WorkflowCanvasNodeData>[], sizes: readonly LoopChildSize[]): Node<WorkflowCanvasNodeData>[] {
  const measured = new Map<string, LoopChildSize>(sizes.map(size => [size.nodeId, size]))
  return nodes.map(node => {
    if (!node.data?.compoundLoop) return node
    let width = 0
    let height = 0
    for (const child of nodes) {
      const size = measured.get(child.id)
      if (child.parentNode !== node.id || !size) continue
      width = Math.max(width, child.position.x + size.width + 24)
      height = Math.max(height, child.position.y + size.height + 24)
    }
    const style = node.style
    // Adapter-generated compound frames always have an object style.
    if (!style || typeof style !== 'object') return node
    width = Math.max(Number.parseFloat(String(style.width)) || 720, width)
    height = Math.max(Number.parseFloat(String(style.height)) || 480, height)
    return { ...node, style: { ...style, width: `${width}px`, height: `${height}px` } }
  })
}
