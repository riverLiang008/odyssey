import { uuidSchema, type UUID } from '@odyssey/schemas'

export interface WorkflowIdFactory {
  nodeId(): UUID
  edgeId(): UUID
  branchHandleId(): UUID
}

function newUuid(): UUID {
  return uuidSchema.parse(crypto.randomUUID())
}

export const cryptoWorkflowIdFactory: WorkflowIdFactory = {
  nodeId: newUuid,
  edgeId: newUuid,
  branchHandleId: newUuid,
}

