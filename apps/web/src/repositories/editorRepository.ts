import type {
  AgentWorkflowEditorDocument,
  JourneyEditorDocument,
  RepositoryResult,
  SaveAgentWorkflowInput,
  SaveAgentWorkflowSuccess,
  SaveJourneyInput,
  SaveJourneySuccess,
  UUID,
} from '@odyssey/schemas'

export interface RepositoryOperationOptions {
  signal?: AbortSignal
}

export interface EditorRepository {
  loadJourney(
    journeyId: UUID,
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<JourneyEditorDocument>>
  saveJourney(
    input: SaveJourneyInput,
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<SaveJourneySuccess>>
  loadAgentWorkflow(
    journeyId: UUID,
    agentId: UUID,
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<AgentWorkflowEditorDocument>>
  saveAgentWorkflow(
    input: SaveAgentWorkflowInput,
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<SaveAgentWorkflowSuccess>>
}
