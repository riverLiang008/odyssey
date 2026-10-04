import { toolKindSchema, type ToolKind, type SystemToolDefinition, uuidSchema, type AgentActionNode, type UUID } from '@odyssey/schemas'
import type { Connection, ViewportTransform } from '@vue-flow/core'

import type { ConnectNodesIntent } from '@/domain/workflow'

export type WorkflowPaletteNodeType = 'branch' | 'loop' | 'agent_action' | 'task'
export const WORKFLOW_NODE_DRAG_MIME = 'application/x-odyssey-workflow-node'
export const WORKFLOW_RESOURCE_DRAG_MIME = 'application/x-odyssey-workflow-resource'
export type WorkflowResourceDragPayload =
  | { readonly kind: 'system-tool-definition'; readonly toolDefinitionId: UUID; readonly toolKind: ToolKind }
  | { readonly kind: 'reusable-tool'; readonly resourceId: UUID }
  | { readonly kind: 'knowledge-space'; readonly resourceId: UUID }
export type WorkflowResourceDropTarget =
  | { readonly kind: 'canvas-pane' }
  | { readonly kind: 'agent-action-tools'; readonly nodeId: UUID }
  | { readonly kind: 'agent-action-knowledge-spaces'; readonly nodeId: UUID }
  | { readonly kind: 'task-tool-sequence'; readonly nodeId: UUID }
export type WorkflowResourceDropErrorCode = 'INVALID_RESOURCE_TARGET' | 'WRONG_RESOURCE_TYPE' | 'RESOURCE_NOT_AVAILABLE' | 'RESOURCE_ALREADY_BOUND'
export type WorkflowResourceDropAction =
  | { readonly type: 'configure-system-tool'; readonly nodeId: UUID; readonly toolDefinitionId: UUID; readonly toolKind: ToolKind }
  | { readonly type: 'bind-reusable-tool'; readonly nodeId: UUID; readonly reusableToolId: UUID }
  | { readonly type: 'unbind-reusable-tool'; readonly nodeId: UUID; readonly reusableToolId: UUID }
  | { readonly type: 'bind-knowledge-space'; readonly nodeId: UUID; readonly knowledgeSpaceId: UUID }
  | { readonly type: 'append-task-tool-step'; readonly nodeId: UUID; readonly reusableToolId: UUID }
export type WorkflowResourceDropEvaluation =
  | { readonly status: 'valid'; readonly action: WorkflowResourceDropAction }
  | { readonly status: 'invalid' | 'duplicate' | 'unavailable'; readonly reason: WorkflowResourceDropErrorCode }

export interface WorkflowNodeDragPayload {
  readonly kind: 'workflow-node-template'
  readonly nodeType: WorkflowPaletteNodeType
}

export type WorkflowCanvasUiErrorCode = 'INVALID_DROP_PAYLOAD' | 'INVALID_CONNECTION' | WorkflowResourceDropErrorCode

const paletteNodeTypes: readonly WorkflowPaletteNodeType[] = ['branch', 'loop', 'agent_action', 'task']

export function serializeWorkflowNodeDragPayload(nodeType: WorkflowPaletteNodeType): string {
  return JSON.stringify({ kind: 'workflow-node-template', nodeType } satisfies WorkflowNodeDragPayload)
}

export function parseWorkflowNodeDragPayload(raw: string): WorkflowNodeDragPayload | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (
      typeof value === 'object'
      && value !== null
      && 'kind' in value
      && value.kind === 'workflow-node-template'
      && 'nodeType' in value
      && typeof value.nodeType === 'string'
      && paletteNodeTypes.includes(value.nodeType as WorkflowPaletteNodeType)
    ) return { kind: 'workflow-node-template', nodeType: value.nodeType as WorkflowPaletteNodeType }
  } catch {
    if (paletteNodeTypes.includes(raw as WorkflowPaletteNodeType)) {
      return { kind: 'workflow-node-template', nodeType: raw as WorkflowPaletteNodeType }
    }
  }
  return null
}

export function serializeWorkflowResourceDragPayload(resourceId: UUID, kind: 'reusable-tool' | 'knowledge-space' = 'reusable-tool'): string {
  return JSON.stringify({ kind, resourceId } satisfies WorkflowResourceDragPayload)
}

export function parseWorkflowResourceDragPayload(raw: string): WorkflowResourceDragPayload | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'system-tool-definition') {
      if (!('toolDefinitionId' in value) || !('toolKind' in value) || Object.keys(value).length !== 3) return null
      const id = uuidSchema.safeParse(value.toolDefinitionId)
      const kind = toolKindSchema.safeParse(value.toolKind)
      return id.success && kind.success ? { kind: 'system-tool-definition', toolDefinitionId: id.data, toolKind: kind.data } : null
    }
    if (typeof value !== 'object' || value === null || !('kind' in value) || (value.kind !== 'reusable-tool' && value.kind !== 'knowledge-space') || !('resourceId' in value)) return null
    const resourceId = uuidSchema.safeParse(value.resourceId)
    return resourceId.success ? { kind: value.kind, resourceId: resourceId.data } : null
  } catch { return null }
}

export function evaluateWorkflowResourceDrop(
  payload: WorkflowResourceDragPayload,
  target: WorkflowResourceDropTarget,
  context: { readonly node: AgentActionNode | { readonly id: UUID; readonly type: 'task' } | null; readonly mode?: 'flow' | 'configure'; readonly systemTools?: readonly SystemToolDefinition[]; readonly availableReusableToolIds: ReadonlySet<UUID>; readonly availableKnowledgeSpaceIds?: ReadonlySet<UUID> },
): WorkflowResourceDropEvaluation {
  if (context.mode === 'flow') return { status: 'invalid', reason: 'INVALID_RESOURCE_TARGET' }
  if (target.kind === 'canvas-pane') return { status: 'invalid', reason: 'INVALID_RESOURCE_TARGET' }
  if (!context.node || context.node.id !== target.nodeId) return { status: 'invalid', reason: 'INVALID_RESOURCE_TARGET' }
  if (payload.kind === 'system-tool-definition') {
    if (target.kind !== 'task-tool-sequence' || context.node.type !== 'task') return { status: 'invalid', reason: 'INVALID_RESOURCE_TARGET' }
    if (!context.systemTools?.some((t) => t.id === payload.toolDefinitionId && t.kind === payload.toolKind)) return { status: 'unavailable', reason: 'RESOURCE_NOT_AVAILABLE' }
    return { status: 'valid', action: { type: 'configure-system-tool', nodeId: target.nodeId, toolDefinitionId: payload.toolDefinitionId, toolKind: payload.toolKind } }
  }
  if (target.kind === 'task-tool-sequence') {
    if (payload.kind !== 'reusable-tool') return { status: 'invalid', reason: 'WRONG_RESOURCE_TYPE' }
    if (context.node.type !== 'task') return { status: 'invalid', reason: 'INVALID_RESOURCE_TARGET' }
    if (!context.availableReusableToolIds.has(payload.resourceId)) return { status: 'unavailable', reason: 'RESOURCE_NOT_AVAILABLE' }
    return { status: 'valid', action: { type: 'append-task-tool-step', nodeId: target.nodeId, reusableToolId: payload.resourceId } }
  }
  if (context.node.type !== 'agent_action') return { status: 'invalid', reason: 'INVALID_RESOURCE_TARGET' }
  if (payload.kind === 'knowledge-space') {
    if (target.kind !== 'agent-action-knowledge-spaces') return { status: 'invalid', reason: 'WRONG_RESOURCE_TYPE' }
    if (!context.availableKnowledgeSpaceIds?.has(payload.resourceId)) return { status: 'unavailable', reason: 'RESOURCE_NOT_AVAILABLE' }
    if (context.node.config.knowledgeSpaceIds.includes(payload.resourceId)) return { status: 'duplicate', reason: 'RESOURCE_ALREADY_BOUND' }
    return { status: 'valid', action: { type: 'bind-knowledge-space', nodeId: target.nodeId, knowledgeSpaceId: payload.resourceId } }
  }
  if (target.kind !== 'agent-action-tools') return { status: 'invalid', reason: 'WRONG_RESOURCE_TYPE' }
  if (!context.availableReusableToolIds.has(payload.resourceId)) return { status: 'unavailable', reason: 'RESOURCE_NOT_AVAILABLE' }
  if (context.node.config.reusableToolIds.includes(payload.resourceId)) return { status: 'duplicate', reason: 'RESOURCE_ALREADY_BOUND' }
  return { status: 'valid', action: { type: 'bind-reusable-tool', nodeId: target.nodeId, reusableToolId: payload.resourceId } }
}

export type WorkflowCanvasIntent =
  | { readonly type: 'select-node'; readonly nodeId: UUID | null }
  | { readonly type: 'select-edge'; readonly edgeId: UUID | null }
  | { readonly type: 'move-node'; readonly nodeId: UUID; readonly x: number; readonly y: number }
  | { readonly type: 'update-viewport'; readonly x: number; readonly y: number; readonly zoom: number }
  | { readonly type: 'create-node'; readonly nodeType: WorkflowPaletteNodeType; readonly x: number; readonly y: number }

export function connectionToIntent(connection: Connection, edgeId: UUID): ConnectNodesIntent | null {
  const source = uuidSchema.safeParse(connection.source)
  const target = uuidSchema.safeParse(connection.target)
  if (!source.success || !target.success) return null
  const handle = connection.sourceHandle ? uuidSchema.safeParse(connection.sourceHandle) : null
  if (handle && !handle.success) return null
  return {
    edgeId,
    sourceNodeId: source.data,
    targetNodeId: target.data,
    ...(handle?.success ? { sourceHandleId: handle.data } : {}),
  }
}

export function viewportToIntent(viewport: ViewportTransform): WorkflowCanvasIntent {
  return { type: 'update-viewport', x: viewport.x, y: viewport.y, zoom: viewport.zoom }
}
