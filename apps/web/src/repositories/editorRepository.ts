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
  RepositoryError,
  SaveAgentAsTemplateInput,
  SaveAgentAsTemplateSuccess,
  SaveAgentWorkflowInput,
  SaveAgentWorkflowSuccess,
  SaveJourneyInput,
  SaveJourneySuccess,
  UUID,
  JourneySummary,
  KnowledgeSpaceSummaryPage,
  KnowledgeSpaceCategorySummary,
  KnowledgeSpaceDetail,
  CreateKnowledgeSpaceCategoryInput,
  CreateKnowledgeSpaceInput,
  UpdateKnowledgeSpaceInput,
  KnowledgeSpaceRevisionCommand,
  DeleteKnowledgeSpaceSuccess,
  KnowledgeFileTree,
  KnowledgeGraphOverview,
  KnowledgeGraphManifest,
  ValidateKnowledgeGraphManifestResult,
  ApplyKnowledgeGraphManifestResult,
  KnowledgeResourceDetail,
  CreateKnowledgeFolderInput,
  CreateKnowledgeFolderSuccess,
  MoveKnowledgeResourceInput,
  MoveKnowledgeResourceSuccess,
  DeleteKnowledgeResourceInput,
  DeleteKnowledgeResourceSuccess,
  UpdateKnowledgeResourceContentInput,
  UpdateKnowledgeResourceContentSuccess,
  CompleteKnowledgeUploadSuccess,
  CreateJourneyInput,
  DeleteJourneyInput,
  DeleteJourneySuccess,
} from '@odyssey/schemas'

export interface RepositoryOperationOptions {
  signal?: AbortSignal
}

/** Frontend access capability; never serialized into an API or domain document. */
export interface RepositoryCapabilities { readonly readOnly?: boolean }

export interface UploadKnowledgeFileInput {
  knowledgeSpaceId: UUID
  folderId: UUID
  expectedRevision: number
  file: File
}

export type KnowledgeResourcePreview =
  | { type: 'text'; content: string; truncated: boolean }
  | { type: 'external' }
  | { type: 'failed'; error: RepositoryError }

export interface KnowledgeResourceInspection {
  detail: KnowledgeResourceDetail
  preview: KnowledgeResourcePreview
}

export interface KnowledgeSpaceInventoryRepository extends RepositoryCapabilities {
  listKnowledgeSpaces(
    input?: { query?: string; page?: number; pageSize?: number; includeArchived?: boolean },
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<KnowledgeSpaceSummaryPage>>
  listKnowledgeSpaceCategories(
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<KnowledgeSpaceCategorySummary[]>>
  createKnowledgeSpaceCategory(
    input: CreateKnowledgeSpaceCategoryInput,
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<KnowledgeSpaceCategorySummary>>
  createKnowledgeSpace(
    input: CreateKnowledgeSpaceInput,
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<KnowledgeSpaceDetail>>
  loadKnowledgeSpace(
    knowledgeSpaceId: UUID,
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<KnowledgeSpaceDetail>>
  updateKnowledgeSpace(input: UpdateKnowledgeSpaceInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeSpaceDetail>>
  archiveKnowledgeSpace(input: KnowledgeSpaceRevisionCommand, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeSpaceDetail>>
  unarchiveKnowledgeSpace(input: KnowledgeSpaceRevisionCommand, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeSpaceDetail>>
  deleteKnowledgeSpace(input: KnowledgeSpaceRevisionCommand, options?: RepositoryOperationOptions): Promise<RepositoryResult<DeleteKnowledgeSpaceSuccess>>
  loadKnowledgeFileTree(knowledgeSpaceId: UUID, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeFileTree>>
  loadKnowledgeGraph(knowledgeSpaceId: UUID, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeGraphOverview>>
  validateKnowledgeGraphManifest(knowledgeSpaceId: UUID, expectedRevision: number, manifest: KnowledgeGraphManifest, options?: RepositoryOperationOptions): Promise<RepositoryResult<ValidateKnowledgeGraphManifestResult>>
  applyKnowledgeGraphManifest(knowledgeSpaceId: UUID, input: { expectedRevision: number; validationToken: string; manifestChecksum: string; manifest: KnowledgeGraphManifest }, options?: RepositoryOperationOptions): Promise<RepositoryResult<ApplyKnowledgeGraphManifestResult>>
  loadKnowledgeResource(knowledgeSpaceId: UUID, resourceId: UUID, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeResourceInspection>>
  createKnowledgeFolder(input: CreateKnowledgeFolderInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<CreateKnowledgeFolderSuccess>>
  moveKnowledgeResource(input: MoveKnowledgeResourceInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<MoveKnowledgeResourceSuccess>>
  deleteKnowledgeResource(input: DeleteKnowledgeResourceInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<DeleteKnowledgeResourceSuccess>>
  updateKnowledgeResourceContent(input: UpdateKnowledgeResourceContentInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<UpdateKnowledgeResourceContentSuccess>>
  uploadKnowledgeFile(input: UploadKnowledgeFileInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<CompleteKnowledgeUploadSuccess>>
}

export interface JourneyEditorRepository extends RepositoryCapabilities {
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

export interface WorkflowEditorRepository extends Pick<KnowledgeSpaceInventoryRepository, 'listKnowledgeSpaces'>, RepositoryCapabilities {
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

export interface JourneyLifecycleRepository extends RepositoryCapabilities {
  listJourneys(options?: RepositoryOperationOptions): Promise<RepositoryResult<JourneySummary[]>>
  createJourney(input: CreateJourneyInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<JourneyEditorDocument>>
  deleteJourney(input: DeleteJourneyInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<DeleteJourneySuccess>>
}

export interface AgentLifecycleRepository extends RepositoryCapabilities {
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

export interface GuardrailLifecycleRepository extends RepositoryCapabilities {
  addGuardrail(
    input: AddGuardrailInput,
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<AddGuardrailSuccess>>
  removeGuardrail(
    input: RemoveGuardrailInput,
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<JourneyEditorDocument>>
}

export type OdysseyEditorRepository = EditorRepository & KnowledgeSpaceInventoryRepository & AgentLifecycleRepository & GuardrailLifecycleRepository & JourneyLifecycleRepository
