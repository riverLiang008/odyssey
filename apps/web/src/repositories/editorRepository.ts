import type {
  SystemToolDefinition,
  AgentTemplate,
  AddGuardrailInput,
  AddGuardrailSuccess,
  AgentWorkflowEditorDocument,
  CreateJourneyAgentInput,
  CreateOrInstantiateAgentSuccess,
  InstantiateAgentTemplateInput,
  RemoveOccupiedSlotInput,
  RemoveOccupiedSlotSuccess,
  RemoveGuardrailInput,
  JourneyEditorDocument,
  RepositoryResult,
  SaveAgentAsTemplateInput,
  SaveAgentAsTemplateSuccess,
  SaveAgentWorkflowInput,
  SaveAgentWorkflowSuccess,
  SaveJourneyInput,
  SaveJourneySuccess,
  UUID,
  JourneySummary,
  KnowledgeSpaceSummaryPage,
  CreateJourneyInput,
  DeleteJourneyInput,
  DeleteJourneySuccess,
} from '@odyssey/schemas'

export interface RepositoryOperationOptions {
  signal?: AbortSignal
}

export interface KnowledgeSpaceInventoryRepository {
  listKnowledgeSpaces(
    input?: { query?: string; page?: number; pageSize?: number },
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<KnowledgeSpaceSummaryPage>>
}

export interface JourneyEditorRepository {
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
}

export interface WorkflowEditorRepository extends KnowledgeSpaceInventoryRepository {
  listSystemToolDefinitions(options?: RepositoryOperationOptions): Promise<RepositoryResult<SystemToolDefinition[]>>
  loadJourney(
    journeyId: UUID,
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<JourneyEditorDocument>>
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

export type EditorRepository = JourneyEditorRepository & WorkflowEditorRepository

export interface JourneyLifecycleRepository {
  listJourneys(options?: RepositoryOperationOptions): Promise<RepositoryResult<JourneySummary[]>>
  createJourney(input: CreateJourneyInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<JourneyEditorDocument>>
  deleteJourney(input: DeleteJourneyInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<DeleteJourneySuccess>>
}

export interface AgentLifecycleRepository {
  listAgentTemplates(options?: RepositoryOperationOptions): Promise<RepositoryResult<AgentTemplate[]>>
  loadAgentTemplate(
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
  removeOccupiedSlot(
    input: RemoveOccupiedSlotInput,
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<RemoveOccupiedSlotSuccess>>
}

export interface GuardrailLifecycleRepository {
  addGuardrail(
    input: AddGuardrailInput,
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<AddGuardrailSuccess>>
  removeGuardrail(
    input: RemoveGuardrailInput,
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<JourneyEditorDocument>>
}

export type OdysseyEditorRepository = EditorRepository & AgentLifecycleRepository & GuardrailLifecycleRepository & JourneyLifecycleRepository
