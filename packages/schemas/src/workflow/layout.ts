import { z } from 'zod'

import { schemaVersionSchema, uuidSchema } from '../common'

export const nodePlacementSchema = z.strictObject({
  nodeId: uuidSchema,
  x: z.number().finite(),
  y: z.number().finite(),
})

export const canvasViewportSchema = z.strictObject({
  x: z.number().finite(),
  y: z.number().finite(),
  zoom: z.number().finite().positive(),
})

const canvasLayoutFields = {
  nodePlacements: z.array(nodePlacementSchema),
  viewport: canvasViewportSchema,
} as const

function addUniquePlacementRefinement<T extends { nodePlacements: Array<{ nodeId: string }> }>(
  layout: T,
  context: z.RefinementCtx,
) {
  const nodeIds = new Set<string>()
  layout.nodePlacements.forEach((placement, index) => {
    if (nodeIds.has(placement.nodeId)) {
      context.addIssue({
        code: 'custom',
        message: 'Canvas layout may contain only one placement per node',
        path: ['nodePlacements', index, 'nodeId'],
      })
    }
    nodeIds.add(placement.nodeId)
  })
}

export const embeddedCanvasLayoutSchema = z
  .strictObject(canvasLayoutFields)
  .superRefine(addUniquePlacementRefinement)

export const canvasLayoutSchema = z
  .strictObject({ schemaVersion: schemaVersionSchema, ...canvasLayoutFields })
  .superRefine(addUniquePlacementRefinement)

export type NodePlacement = z.infer<typeof nodePlacementSchema>
export type CanvasViewport = z.infer<typeof canvasViewportSchema>
export type CanvasLayout = z.infer<typeof canvasLayoutSchema>
