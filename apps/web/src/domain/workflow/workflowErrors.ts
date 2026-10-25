import type { UUID } from '@odyssey/schemas'

export type WorkflowGraphContext =
  | { readonly kind: 'agent-workflow' }
  | { readonly kind: 'loop-body'; readonly loopNodeId: UUID }

export type WorkflowValidationIssueCode =
  | 'INVALID_CONTRACT'
  | 'DUPLICATE_NODE_ID'
  | 'DUPLICATE_EDGE_ID'
  | 'MISSING_EDGE_SOURCE'
  | 'MISSING_EDGE_TARGET'
  | 'SELF_EDGE'
  | 'DUPLICATE_EDGE'
  | 'CYCLE_DETECTED'
  | 'START_CARDINALITY'
  | 'END_CARDINALITY'
  | 'LOOP_START_CARDINALITY'
  | 'LOOP_END_CARDINALITY'
  | 'START_HAS_INCOMING'
  | 'END_HAS_OUTGOING'
  | 'INVALID_NODE_KIND'
  | 'INVALID_SOURCE_HANDLE'
  | 'BRANCH_ROUTE_INCOMPLETE'
  | 'BRANCH_ROUTE_DUPLICATE'
  | 'UNREACHABLE_FROM_START'
  | 'CANNOT_REACH_END'
  | 'INVALID_LOOP_BODY'

export interface WorkflowValidationIssue {
  readonly code: WorkflowValidationIssueCode
  readonly nodeId?: UUID
  readonly edgeId?: UUID
  readonly sourceHandleId?: UUID
  readonly path?: readonly (string | number)[]
}

export interface WorkflowValidationReport {
  readonly structuralErrors: readonly WorkflowValidationIssue[]
  readonly readinessErrors: readonly WorkflowValidationIssue[]
  readonly isStructurallyValid: boolean
  readonly isExecutionReady: boolean
}

export type WorkflowDomainError =
  | { readonly code: 'INVALID_SOURCE_GRAPH'; readonly issues: readonly WorkflowValidationIssue[] }
  | { readonly code: 'NODE_NOT_FOUND'; readonly nodeId: UUID }
  | { readonly code: 'EDGE_NOT_FOUND'; readonly edgeId: UUID }
  | { readonly code: 'NODE_ID_CONFLICT'; readonly nodeId: UUID }
  | { readonly code: 'EDGE_ID_CONFLICT'; readonly edgeId: UUID }
  | { readonly code: 'BOUNDARY_NODE_IMMUTABLE'; readonly nodeId: UUID }
  | { readonly code: 'NODE_KIND_NOT_ALLOWED'; readonly nodeType: string; readonly context: WorkflowGraphContext }
  | { readonly code: 'MISSING_ENDPOINT'; readonly endpoint: 'source' | 'target'; readonly nodeId: UUID }
  | { readonly code: 'SELF_EDGE'; readonly nodeId: UUID }
  | { readonly code: 'DUPLICATE_EDGE'; readonly sourceNodeId: UUID; readonly sourceHandleId?: UUID; readonly targetNodeId: UUID }
  | { readonly code: 'INVALID_EDGE_DIRECTION'; readonly sourceNodeId: UUID; readonly targetNodeId: UUID }
  | { readonly code: 'HANDLE_REQUIRED'; readonly branchNodeId: UUID }
  | { readonly code: 'HANDLE_NOT_ALLOWED'; readonly sourceNodeId: UUID }
  | { readonly code: 'HANDLE_NOT_FOUND'; readonly branchNodeId: UUID; readonly sourceHandleId: UUID }
  | { readonly code: 'HANDLE_ALREADY_CONNECTED'; readonly branchNodeId: UUID; readonly sourceHandleId: UUID }
  | { readonly code: 'CYCLE_DETECTED'; readonly sourceNodeId: UUID; readonly targetNodeId: UUID }
  | { readonly code: 'INVALID_NODE_CONFIG'; readonly nodeId: UUID }
  | { readonly code: 'INVALID_LOOP_BODY'; readonly loopNodeId: UUID; readonly issues: readonly WorkflowValidationIssue[] }
  | { readonly code: 'RESOURCE_TARGET_INVALID'; readonly nodeId: UUID }
  | { readonly code: 'RESOURCE_NOT_AVAILABLE'; readonly resourceId: string }
  | { readonly code: 'RESOURCE_ALREADY_BOUND'; readonly nodeId: UUID; readonly resourceId: string }
  | { readonly code: 'RESOURCE_NOT_BOUND'; readonly nodeId: UUID; readonly resourceId: string }
  | { readonly code: 'RESOURCE_IN_USE'; readonly resourceId: string; readonly referenceCount: number }
  | { readonly code: 'RESOURCE_ID_CONFLICT'; readonly resourceId: string }

export type WorkflowCommandResult<T> =
  | { readonly ok: true; readonly value: T; readonly validation: WorkflowValidationReport }
  | { readonly ok: false; readonly error: WorkflowDomainError }
