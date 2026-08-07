# Knowledge Space Module Specification

## 1. Overview

The Knowledge Space module provides a user-facing file workspace and a machine-oriented knowledge graph over the same collection of documents.

A Knowledge Space (KS) behaves like a lightweight Google Drive folder:

- Users create folders, upload files, and maintain the directory structure.
- Subfolders are meaningful only to the user. Odyssey does not infer semantic meaning from folder placement.
- Odyssey reads all supported files beneath the KS root and manages them as one knowledge graph.
- A KS belongs to exactly one workspace category for list-level organization.
- Documents may have multiple knowledge tags. These tags organize graph regions and Knowledge Families; they are distinct from the workspace category.

Two OdyJourneys maintain the graph:

- **Document Curator OdyJourney** is event-driven. It ingests a newly added or changed document, generates its initial metadata, and performs a local graph update.
- **Knowledge Steward OdyJourney** runs periodically. It reviews the complete KS, reconciles cross-document relationships, detects issues, and performs global graph maintenance.

## 2. Information Architecture

The module contains two primary views:

1. **Knowledge Space List — User Scope**
2. **Knowledge Space Detail — Per Knowledge Space**

The List view organizes a user's Knowledge Spaces by workspace category. The Detail view exposes both the user-maintained folder hierarchy and the Odyssey-maintained knowledge graph.

## 3. Terminology

| Term | Definition |
| --- | --- |
| Knowledge Space | A root folder and all documents beneath it, managed as one semantic graph. |
| Workspace Category | A single user-assigned category used to organize Knowledge Spaces in the List view. UI label: **Category**. |
| Knowledge Tag | A document-level semantic label inferred or edited within a KS. A document may have multiple knowledge tags. |
| Knowledge Family | A semantically related graph region presented as a visual group. A family may contain one or more documents. |
| Document Node | A graph node representing one indexed document. |
| Reference Edge | A directed semantic relationship between two document nodes. |
| Graph Issue | A condition requiring attention, such as an unlinked document, possible conflict, or broken reference. |

## 4. Knowledge Space List

### 4.1 Purpose

Provide a visual overview of all Knowledge Spaces owned by the current user without reducing them to a conventional database table.

### 4.2 Default layout

Use a **categorized card view**:

- Each workspace category is displayed as a labeled section.
- A colored divider visually anchors each category.
- Knowledge Space cards are arranged in a responsive grid within the section.
- Category sections may be collapsed.
- Empty categories are hidden unless the user is editing category configuration.
- The entire result area scrolls vertically.

Recommended desktop grid:

- Minimum card width: 240 px.
- Preferred card width: 260–300 px.
- Gap: 20–24 px.
- Use 2–4 columns depending on viewport width.

### 4.3 Toolbar

The top toolbar contains:

- Search input: searches KS name and description.
- Category filter: multi-select.
- Graph status filter: multi-select.
- Sort control.
- `+ New Knowledge Space` primary action.

Sort options:

| UI label | Field | Direction |
| --- | --- | --- |
| Recently updated | `updatedAt` | Descending |
| Name | `name` | Ascending |
| Created time | `createdAt` | Descending |

Search should be case-insensitive. Search results remain grouped by category when several categories match. If no item matches, show a unified no-results state rather than empty category sections.

### 4.4 Knowledge Space card

Each card displays:

- KS name.
- Optional one-line description.
- Graph status indicator and label.
- File count.
- Knowledge Family count.
- Relative update time.
- Optional issue count when review is required.

Example:

```text
Shadow AI Thesis                         ● Needs review
A research space for the Shadow AI study.

37 files  ·  6 families
3 issues  ·  Updated 2h ago
```

Interaction:

- Clicking a card opens its Knowledge Space Detail view.
- The whole card is one click target.
- A secondary overflow menu may contain Rename, Change category, Archive, and Delete.
- Destructive actions must not be exposed as the card's primary interaction.

### 4.5 List states

| State | Required presentation |
| --- | --- |
| Loading | Skeleton cards grouped under skeleton section labels. |
| Empty user scope | Explanation plus `Create your first Knowledge Space`. |
| No search results | Search-specific empty state plus `Clear filters`. |
| Partial load failure | Preserve loaded categories and show an inline retry message. |

## 5. Knowledge Space Detail

### 5.1 Default overview layout

The desktop layout contains:

- **Left panel:** user-maintained folder tree.
- **Right upper panel:** Knowledge Space overview.
- **Right main panel:** knowledge graph.

The left panel and right content area should be resizable. The folder panel may be collapsed.

### 5.2 Folder tree

The folder tree represents the actual user-maintained directory structure. Odyssey must not reorganize folders as part of graph maintenance.

Supported primary actions:

- Upload file.
- Create folder.

Optional future action:

- Create document.

Interaction requirements:

- Provide a visible Add control at the bottom or top of the tree.
- The same actions may also appear in the folder context menu.
- Right-click must not be the only way to discover these actions.
- Clicking a file selects the corresponding graph node and opens its Inspector.
- Expand/collapse state belongs to the user interface and does not affect graph structure.

### 5.3 Knowledge Space overview

Display:

- KS name.
- Description.
- Category chip.
- Graph status.
- File count.
- Knowledge Family count.
- Last document indexed time.
- Last Knowledge Steward run time.

Example:

```text
Coffee Knowledge Base                              ● Healthy
A practical knowledge space for coffee beans, brewing methods,
espresso extraction, and troubleshooting.

[ Personal ]

24 Files        4 Knowledge Families

Last document indexed    Aug 3, 2026 · 20:42
Last Steward run         Aug 3, 2026 · 03:00
```

When `graphStatus = NEEDS_REVIEW`, display the issue count and a short summary beneath the status, for example: `3 issues: 2 unlinked documents and 1 possible conflict`.

### 5.4 Knowledge graph

The graph visualizes every indexed document beneath the KS root, regardless of subfolder placement.

Visual rules:

- One document maps to one node.
- Directed edges represent document relationships.
- Knowledge Families are shown as lightly tinted spatial containers.
- A singleton document may form a one-node Knowledge Family.
- Family colors distinguish groups but must remain low-saturation and accessible.
- Selected nodes use a high-contrast outline rather than color alone.
- Issue-bearing nodes use a warning marker in addition to color.

Graph interaction:

- Pan the canvas by dragging empty space.
- Zoom with wheel or trackpad.
- Single-click a node to select it and open the Document Inspector.
- Double-click a node to open the full Document Detail view.
- Clicking empty graph space clears the selection and closes the Inspector.
- Hovering a node shows its full filename if the label is truncated.
- Selecting a file in the folder tree selects and centers the same graph node.

### 5.5 Document Inspector

The Inspector is a contextual overlay or side panel that preserves the user's graph context.

It displays:

- Filename.
- Document status.
- Knowledge tags.
- Summary.
- Guide.
- Incoming and outgoing references.
- `Open document` action.

The Inspector should not cover the selected node when sufficient canvas space is available. It may be repositioned or converted into a fixed right-side panel on smaller desktop widths.

### 5.6 Document Detail

The full Document Detail view contains:

- The folder tree on the left.
- Editable document metadata at the top of the content area.
- Document content or preview below.
- A Back to graph action that restores the previous pan, zoom, and node selection.

Editable metadata:

- Knowledge tags.
- Summary.
- Guide.
- User-reviewable references.

System-owned metadata such as indexing timestamps and generated issue codes should be read-only.

## 6. Status Model

Do not use one `status` field for both operational progress and graph quality. Use separate fields.

### 6.1 Knowledge Space lifecycle status

```ts
enum KnowledgeSpaceLifecycleStatus {
  INITIALIZING = "INITIALIZING",
  READY = "READY",
  SYNCING = "SYNCING",
  FAILED = "FAILED",
  ARCHIVED = "ARCHIVED"
}
```

| Value | Meaning | List behavior |
| --- | --- | --- |
| `INITIALIZING` | KS exists but initial indexing has not completed. | Show progress state; card remains accessible. |
| `READY` | KS is available for normal use. | Normal card behavior. |
| `SYNCING` | A document batch or global graph update is running. | Show subtle activity indicator; retain last valid graph. |
| `FAILED` | The KS cannot complete a required initialization or synchronization operation. | Show error state and retry entry point. |
| `ARCHIVED` | KS is intentionally hidden from the default active view. | Only shown when Archive filter is enabled. |

### 6.2 Graph status

```ts
enum KnowledgeGraphStatus {
  NOT_INDEXED = "NOT_INDEXED",
  HEALTHY = "HEALTHY",
  NEEDS_REVIEW = "NEEDS_REVIEW",
  ERROR = "ERROR"
}
```

| Value | Meaning | Suggested UI |
| --- | --- | --- |
| `NOT_INDEXED` | No valid graph snapshot exists yet. | Neutral gray; `Not indexed`. |
| `HEALTHY` | No unresolved review-level or blocking issues are known. | Green; `Healthy`. |
| `NEEDS_REVIEW` | A valid graph exists, but one or more non-blocking issues require user review. | Amber; `Needs review`. |
| `ERROR` | The graph snapshot is missing, invalid, or could not be produced. | Red; `Graph error`. |

`SYNCING` is deliberately not a graph status. During a Steward run, the existing graph may remain `HEALTHY` or `NEEDS_REVIEW` while `lifecycleStatus` is `SYNCING`.

### 6.3 Document status

```ts
enum DocumentIndexStatus {
  PENDING = "PENDING",
  INDEXING = "INDEXING",
  INDEXED = "INDEXED",
  NEEDS_REVIEW = "NEEDS_REVIEW",
  UNSUPPORTED = "UNSUPPORTED",
  FAILED = "FAILED"
}
```

### 6.4 OdyJourney run status

```ts
enum OdyJourneyRunStatus {
  QUEUED = "QUEUED",
  RUNNING = "RUNNING",
  SUCCEEDED = "SUCCEEDED",
  PARTIALLY_SUCCEEDED = "PARTIALLY_SUCCEEDED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED"
}
```

### 6.5 Graph issue types

```ts
enum GraphIssueType {
  UNLINKED_DOCUMENT = "UNLINKED_DOCUMENT",
  BROKEN_REFERENCE = "BROKEN_REFERENCE",
  POSSIBLE_DUPLICATE = "POSSIBLE_DUPLICATE",
  POSSIBLE_CONFLICT = "POSSIBLE_CONFLICT",
  MISSING_METADATA = "MISSING_METADATA",
  STALE_DOCUMENT = "STALE_DOCUMENT",
  FAMILY_ASSIGNMENT_REVIEW = "FAMILY_ASSIGNMENT_REVIEW"
}

enum GraphIssueSeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR"
}

enum GraphIssueResolutionStatus {
  OPEN = "OPEN",
  ACCEPTED = "ACCEPTED",
  RESOLVED = "RESOLVED",
  DISMISSED = "DISMISSED"
}
```

Graph status derivation:

1. If no valid graph snapshot exists, return `NOT_INDEXED`.
2. If an unresolved `ERROR`-severity issue prevents the graph from being used, return `ERROR`.
3. If one or more unresolved `WARNING`-severity issues exist, return `NEEDS_REVIEW`.
4. Otherwise, return `HEALTHY`.

An `INFO` issue alone does not change the graph from `HEALTHY`.

## 7. Data Model

The following TypeScript-style model describes the UI-facing domain structure. Storage tables may normalize these entities later.

```ts
type ID = string;
type ISODateTime = string;

interface KnowledgeSpace {
  id: ID;
  ownerId: ID;
  name: string;
  description?: string;
  categoryId: ID;
  rootFolderId: ID;

  lifecycleStatus: KnowledgeSpaceLifecycleStatus;
  graphStatus: KnowledgeGraphStatus;

  fileCount: number;
  knowledgeFamilyCount: number;
  openIssueCount: number;

  lastDocumentIndexedAt?: ISODateTime;
  lastStewardRunAt?: ISODateTime;
  latestGraphSnapshotId?: ID;

  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  archivedAt?: ISODateTime;
}

interface WorkspaceCategory {
  id: ID;
  ownerId: ID;
  name: string;
  colorToken: string;
  sortOrder: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

interface FolderNode {
  id: ID;
  knowledgeSpaceId: ID;
  parentFolderId?: ID;
  name: string;
  path: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

interface KnowledgeDocument {
  id: ID;
  knowledgeSpaceId: ID;
  folderId: ID;
  filename: string;
  path: string;
  mimeType: string;
  sizeBytes: number;

  indexStatus: DocumentIndexStatus;
  summary?: string;
  guide?: string;
  contentHash?: string;

  lastIndexedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

interface KnowledgeTag {
  id: ID;
  knowledgeSpaceId: ID;
  name: string;
  colorToken?: string;
  createdBy: "USER" | "DOCUMENT_CURATOR" | "KNOWLEDGE_STEWARD";
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

interface DocumentTagAssignment {
  documentId: ID;
  tagId: ID;
  confidence?: number;
  source: "USER" | "DOCUMENT_CURATOR" | "KNOWLEDGE_STEWARD";
  confirmedByUser: boolean;
  createdAt: ISODateTime;
}

interface KnowledgeFamily {
  id: ID;
  knowledgeSpaceId: ID;
  name: string;
  description?: string;
  colorToken: string;
  memberCount: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

interface KnowledgeFamilyMembership {
  familyId: ID;
  documentId: ID;
  confidence?: number;
  source: "USER" | "DOCUMENT_CURATOR" | "KNOWLEDGE_STEWARD";
  createdAt: ISODateTime;
}

interface DocumentReference {
  id: ID;
  knowledgeSpaceId: ID;
  sourceDocumentId: ID;
  targetDocumentId: ID;
  relationType: DocumentRelationType;
  description?: string;
  confidence?: number;
  source: "USER" | "DOCUMENT_CURATOR" | "KNOWLEDGE_STEWARD";
  confirmedByUser: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

enum DocumentRelationType {
  REFERENCES = "REFERENCES",
  BUILDS_ON = "BUILDS_ON",
  EXPLAINS = "EXPLAINS",
  SUPPORTS = "SUPPORTS",
  CONTRADICTS = "CONTRADICTS",
  SUPERSEDES = "SUPERSEDES",
  RELATED_TO = "RELATED_TO"
}

interface GraphIssue {
  id: ID;
  knowledgeSpaceId: ID;
  documentIds: ID[];
  referenceIds?: ID[];
  type: GraphIssueType;
  severity: GraphIssueSeverity;
  resolutionStatus: GraphIssueResolutionStatus;
  title: string;
  description?: string;
  detectedByRunId: ID;
  createdAt: ISODateTime;
  resolvedAt?: ISODateTime;
}

interface OdyJourneyRun {
  id: ID;
  knowledgeSpaceId: ID;
  journeyType: "DOCUMENT_CURATOR" | "KNOWLEDGE_STEWARD";
  triggerType: "DOCUMENT_CREATED" | "DOCUMENT_UPDATED" | "MANUAL" | "SCHEDULED";
  status: OdyJourneyRunStatus;
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
  processedDocumentCount: number;
  createdIssueCount: number;
  resolvedIssueCount: number;
  errorMessage?: string;
}

interface KnowledgeGraphSnapshot {
  id: ID;
  knowledgeSpaceId: ID;
  generatedByRunId: ID;
  nodeCount: number;
  edgeCount: number;
  familyCount: number;
  createdAt: ISODateTime;
}
```

### 7.1 Derived fields

The following fields are denormalized summaries for fast List and Detail rendering:

- `fileCount`
- `knowledgeFamilyCount`
- `openIssueCount`
- `lastDocumentIndexedAt`
- `lastStewardRunAt`
- `graphStatus`

They should be derived from document, family, issue, and run records rather than manually edited by the user.

### 7.2 Important constraints

- A Knowledge Space has exactly one active workspace category.
- A Knowledge Space has exactly one root folder.
- A document belongs to exactly one folder and one Knowledge Space.
- A document may have zero or more knowledge tags.
- A document may participate in zero or more Knowledge Families if overlapping families are supported. If the initial implementation uses exclusive grouping, enforce at most one active membership.
- References must connect documents within the same Knowledge Space in the initial version.
- Folder hierarchy must not be used as an implicit knowledge relationship.
- Deleting a file removes its active graph node but should preserve audit/run history.

## 8. Creation Flow

`+ New Knowledge Space` opens a modal or focused creation page containing:

- Name — required.
- Description — optional.
- Category — required; allow creating a category inline.
- Initial files — optional upload.

On creation:

1. Create the KS and root folder.
2. Set `lifecycleStatus = INITIALIZING`.
3. Set `graphStatus = NOT_INDEXED`.
4. If files exist, enqueue Document Curator runs.
5. When initialization succeeds, set `lifecycleStatus = READY`.
6. Derive graph status from the resulting snapshot and issues.

## 9. Responsive Behavior

The initial design targets desktop.

At narrower widths:

- List cards reduce to one or two columns.
- Filters move into a filter popover or drawer.
- The Detail folder tree becomes a collapsible drawer.
- The Document Inspector becomes a fixed side panel or bottom sheet.
- The graph remains the primary content surface and must not be compressed below a usable minimum size.

## 10. Accessibility

- Do not communicate health, family identity, or selection through color alone.
- All graph nodes must be keyboard focusable.
- Provide accessible names using the full document filename.
- Ensure the Add control and context-menu actions are reachable by keyboard.
- Use visible focus indicators.
- Maintain sufficient text/background contrast inside tinted cards and family containers.
- Tooltips should not contain information unavailable through focus interaction.

## 11. Figma Deliverables

Create the following desktop frames:

1. KS List — populated default state.
2. KS List — filters/search active.
3. KS List — empty state.
4. KS Detail — graph overview.
5. KS Detail — Document Inspector open.
6. KS Detail — Document Detail open.
7. KS Detail — Needs Review state.
8. New Knowledge Space modal.

Create reusable components for:

- Knowledge Space card.
- Category section header.
- Graph status badge.
- Search/filter/sort toolbar.
- Folder tree item.
- Add file/folder menu.
- Graph document node.
- Knowledge Family container.
- Document Inspector.
- Metadata field.
- Empty state.

Component variants should cover default, hover, selected, focus, disabled, loading, healthy, needs-review, and error states where applicable.

## 12. Sample Data

Use the following content in the Figma mockup:

```ts
const sampleKnowledgeSpaces: KnowledgeSpace[] = [
  {
    id: "ks_coffee",
    ownerId: "user_001",
    name: "Coffee Knowledge Base",
    description: "A practical knowledge space for coffee beans, brewing methods, espresso extraction, and troubleshooting.",
    categoryId: "category_personal",
    rootFolderId: "folder_coffee_root",
    lifecycleStatus: KnowledgeSpaceLifecycleStatus.READY,
    graphStatus: KnowledgeGraphStatus.HEALTHY,
    fileCount: 24,
    knowledgeFamilyCount: 4,
    openIssueCount: 0,
    lastDocumentIndexedAt: "2026-08-03T20:42:00+09:00",
    lastStewardRunAt: "2026-08-03T03:00:00+09:00",
    latestGraphSnapshotId: "snapshot_coffee_001",
    createdAt: "2026-07-18T09:30:00+09:00",
    updatedAt: "2026-08-03T20:42:00+09:00"
  },
  {
    id: "ks_sstm",
    ownerId: "user_001",
    name: "SSTM Research",
    description: "Research notes on the dynamic relationship between self, structure, and power.",
    categoryId: "category_research",
    rootFolderId: "folder_sstm_root",
    lifecycleStatus: KnowledgeSpaceLifecycleStatus.READY,
    graphStatus: KnowledgeGraphStatus.HEALTHY,
    fileCount: 24,
    knowledgeFamilyCount: 4,
    openIssueCount: 0,
    lastDocumentIndexedAt: "2026-08-03T18:00:00+09:00",
    lastStewardRunAt: "2026-08-03T03:15:00+09:00",
    createdAt: "2026-07-08T12:00:00+09:00",
    updatedAt: "2026-08-03T18:00:00+09:00"
  },
  {
    id: "ks_shadow_ai",
    ownerId: "user_001",
    name: "Shadow AI Thesis",
    description: "Research materials for the study of unauthorized generative AI use and knowledge leakage.",
    categoryId: "category_research",
    rootFolderId: "folder_shadow_ai_root",
    lifecycleStatus: KnowledgeSpaceLifecycleStatus.READY,
    graphStatus: KnowledgeGraphStatus.NEEDS_REVIEW,
    fileCount: 37,
    knowledgeFamilyCount: 6,
    openIssueCount: 3,
    lastDocumentIndexedAt: "2026-08-03T16:25:00+09:00",
    lastStewardRunAt: "2026-08-03T03:30:00+09:00",
    createdAt: "2026-06-15T10:00:00+09:00",
    updatedAt: "2026-08-03T16:25:00+09:00"
  }
];
```

For the `Shadow AI Thesis` review state, use these issues:

- 2 unlinked documents.
- 1 possible conflict.

## 13. Out of Scope for the Initial Design

- Sharing and multi-user permissions.
- Cross-KS references.
- Automatic restructuring of user folders.
- Version comparison and document history UI.
- Manual graph edge creation canvas.
- Mobile-first graph editing.
- Advanced graph analytics.

