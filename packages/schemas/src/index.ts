export type Identifier = string

export interface WorkflowNode {
  id: Identifier
  type: 'start' | 'end' | 'agent_action' | 'task' | 'branch' | 'loop'
  name: string
  config: Record<string, unknown>
}

export interface WorkflowEdge {
  id: Identifier
  sourceNodeId: Identifier
  targetNodeId: Identifier
  sourceHandle?: string
  targetHandle?: string
}

/** Semantic workflow data. It must never contain canvas coordinates. */
export interface WorkflowGraph {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export interface CanvasLayout {
  nodePositions: Array<{ nodeId: Identifier; x: number; y: number }>
  viewport: { x: number; y: number; zoom: number }
}

export type VariableOwnership = 'user_managed' | 'shared' | 'agent_managed'

