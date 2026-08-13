import type {
  AgentTemplate,
  AgentWorkflowEditorDocument,
  CreateJourneyAgentInput,
  CreateOrInstantiateAgentSuccess,
  InstantiateAgentTemplateInput,
  JourneyEditorDocument,
  RepositoryResult,
  SaveAgentAsTemplateInput,
  SaveAgentAsTemplateSuccess,
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

export interface AgentLifecycleRepository {
  listAgentTemplates(
    workspaceId: UUID,
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<AgentTemplate[]>>
  loadAgentTemplate(
    workspaceId: UUID,
    templateId: UUID,
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<AgentTemplate>>
  createJourneyAgent(
    input: CreateJourneyAgentInput,
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<CreateOrInstantiateAgentSuccess>>
  saveAgentAsTemplate(
    input: SaveAgentAsTemplateInput,
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<SaveAgentAsTemplateSuccess>>
  instantiateAgentTemplate(
    input: InstantiateAgentTemplateInput,
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<CreateOrInstantiateAgentSuccess>>
}

export type OdysseyEditorRepository = EditorRepository & AgentLifecycleRepository
