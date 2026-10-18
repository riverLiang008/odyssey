import type { KnowledgeFileTree, UUID } from '@odyssey/schemas'

export type KnowledgeResourceMoveEvaluation =
  | { status: 'valid'; resourceId: UUID; targetFolderId: UUID }
  | { status: 'invalid'; reason: 'RESOURCE_NOT_FOUND' | 'TARGET_FOLDER_NOT_FOUND' | 'SAME_FOLDER' }

export function evaluateKnowledgeResourceMove(
  tree: KnowledgeFileTree,
  resourceId: UUID,
  targetFolderId: UUID,
): KnowledgeResourceMoveEvaluation {
  const resource = tree.resources.find((candidate) => candidate.id === resourceId)
  if (!resource) return { status: 'invalid', reason: 'RESOURCE_NOT_FOUND' }
  if (!tree.folders.some((folder) => folder.id === targetFolderId)) return { status: 'invalid', reason: 'TARGET_FOLDER_NOT_FOUND' }
  if (resource.folderId === targetFolderId) return { status: 'invalid', reason: 'SAME_FOLDER' }
  return { status: 'valid', resourceId, targetFolderId }
}
