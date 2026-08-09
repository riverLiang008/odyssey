# Odyssey V1 Design Constraints

> Status: Accepted design constraints for Odyssey V1  
> Scope: Journey editing, component templates, Pattern and Agent Slot behavior, Agent Workflow persistence, Loop composition, and Tool ownership  
> Runtime: Odyssey V1 is a configuration editor and does not include an execution engine

## 1. Product Model

Odyssey is a component-oriented editor. An OdyJourney is comparable to an editor document or workspace that assembles a current configuration from Patterns, Agents, Workflows, Tools, and Knowledge Spaces.

Odyssey V1 distinguishes two forms of data:

1. **Current instances** persisted as part of the current Journey configuration.
2. **Reusable templates** explicitly created through `Save as Template`.

An object does not become a reusable component merely because it is persisted inside a Journey.

```text
Journey Current Configuration
├─ PatternConfig
├─ AgentWorkflow instances
├─ WorkflowGraph and CanvasLayout
├─ Variables
├─ AgentReusableTools
└─ Resource references

Template Library
├─ PatternTemplate
├─ AgentTemplate
└─ ToolTemplate
```

The current Journey configuration must survive refresh, navigation, and reopening. In this document, the word *temporary* means that an instance has no reusable identity outside its owning Journey; it does not mean that the instance is held only in browser memory.

## 2. Template and Instance Boundary

### 2.1 Template instantiation

A template is a blueprint used to create a new independent instance.

Instantiating a template must:

- deep-copy the complete supported configuration;
- create new IDs for the instance and all owned descendants;
- preserve references to independent assets such as Knowledge Spaces;
- avoid any live link between the template and the new instance.

Changes to an instance must not update its source template. Changes to a template must not propagate into existing instances.

V1 supports `Save as new template`. Updating or overwriting a source template from an instance is out of scope unless explicitly added later.

### 2.2 Template sources

V1 supports built-in templates and user-created templates.

- Built-in templates are provided by Odyssey.
- User-created templates are produced through `Save as Template`.
- A `templateKey` records the source or provenance of an instance.
- A `templateKey` does not participate in execution semantics.
- An instance remains valid and editable even if its source template later changes or is unavailable.

## 3. Pattern Model

### 3.1 Built-in Pattern templates

Odyssey V1 includes the four Pattern templates currently defined in Figma:

- `hub_and_spoke`
- `diamond_loop`
- `linear_sequence`
- `solo_component`

These are built-in templates, not the complete set of Pattern types Odyssey may support. Future users and product versions may introduce additional Pattern templates.

A built-in Pattern template only generates an initial `PatternConfig`. After creation, the `PatternConfig` is the authoritative editable configuration.

```ts
interface PatternConfig {
  templateKey?: string
  slots: PatternSlot[]
  routes: PatternRoute[]
}
```

The persisted configuration must contain explicit Slots and Routes. It must not depend on the continued existence of the source template to determine its meaning.

### 3.2 Pattern topology constraints

V1 does not provide a completely free-form Pattern route editor.

- **Linear sequence:** users may add or remove Slots and exchange their order. Routes are derived automatically from Slot order.
- **Solo component:** contains one isolated Slot and no internal Agent route.
- **Hub and spoke:** users may add or remove supported Slots; the Pattern rule maintains the hub-and-spoke topology.
- **Diamond loop:** users may add or remove supported Slots only where permitted by the Pattern rule; the Pattern rule maintains the diamond topology.
- **Custom free-form Pattern:** deferred to a future version.

Users do not manually create or delete Pattern Routes in V1. Pattern-specific domain rules maintain valid Routes after a Slot operation.

### 3.3 Stable identity

Every Slot has a stable `slotId`. Routes reference `slotId`, not display position, Agent name, or canvas coordinates.

```ts
interface PatternSlot {
  slotId: string
  role?: string
  order?: number
  agentInstanceId?: string
}

interface PatternRoute {
  sourceSlotId: string
  target:
    | { type: 'slot'; slotId: string }
    | { type: 'journey_end' }
}
```

## 4. Agent Slot Interaction

### 4.1 Slot layout

Agent Slots cannot be freely positioned by users in V1. The system lays them out automatically according to the active Pattern strategy.

System Canvas Slot coordinates are derived presentation state and are not part of the core Pattern semantics.

- Linear Slots are laid out by `order`.
- New Linear Slots are appended after the current last Slot.
- Hub-and-spoke Slots are arranged around the hub according to the Pattern rule.
- Diamond Slots are positioned according to their topology role.
- Solo uses a fixed single-Slot layout.

The System Canvas should not persist arbitrary Slot `x/y` coordinates for these built-in Patterns.

### 4.2 Supported drag operations

V1 supports all of the following:

1. Drag an Agent Template into an empty Slot.
2. Move or exchange configured Agents between Slots.
3. Reorder Slots where the active Pattern supports ordering.

The same Agent instance cannot occupy multiple Slots in one Journey.

Dragging an Agent from one Slot to another means move or exchange. It does not clone the Agent. Cloning requires an explicit Duplicate operation that creates a new Agent instance and new owned IDs.

For non-linear Patterns, exchanging Agents changes Slot assignments but does not exchange topology roles. For a Linear Pattern, reordering Slots changes `order`, after which Routes and layout are regenerated.

### 4.3 Empty Slot creation

Clicking an empty Slot opens a minimal Agent creation form. The Agent is created only after the user confirms at least its required identity fields, such as name.

After confirmation, Odyssey creates an `AgentWorkflow` instance containing the minimum valid graph:

```text
Start → End
```

Cancelling the form must not leave an anonymous or orphaned Agent record.

### 4.4 Agent cardinality

- One Agent instance belongs to one Journey.
- One Agent instance may be assigned to at most one Pattern Slot in that Journey.
- One configured Slot references zero or one Agent instance.
- An Agent Template may be instantiated many times, but each result is an independent Agent instance.

## 5. Pattern Replacement and Agent Deletion

### 5.1 Switching Pattern

Switching Pattern replaces the current Pattern configuration. Existing Journey Agent instances may be discarded as part of that replacement.

Before replacement, Odyssey must:

1. identify all affected Agent instances;
2. show the affected Agents to the user;
3. offer `Save as Template` for Agents the user wants to preserve;
4. allow the user to discard the remaining Agents or cancel the switch;
5. apply template creation, Agent removal, and Pattern replacement atomically.

The replacement must be handled as one backend transaction. The product must not leave the Journey in a partially replaced state if any operation fails.

The frontend should stage the replacement and request confirmation before destructive persistence. Selecting a Pattern card must not immediately issue multiple irreversible delete calls.

### 5.2 Deleting an Agent

Deleting an Agent must warn the user and offer `Save as Template` before discard.

The UI should distinguish:

- unassign from Slot, if the product exposes an unassigned state;
- save as a new Agent Template;
- permanently discard the Journey Agent instance;
- cancel.

Deleting a Journey Agent may delete its owned Workflow configuration, Variables, and AgentReusableTools according to database cascade rules. It must not delete referenced Knowledge Spaces or reusable templates.

## 6. Agent Template Snapshot

Saving an Agent as a template creates a complete independent snapshot containing:

- Agent identity and metadata;
- Agent goal and supported Agent-level configuration;
- WorkflowGraph;
- CanvasLayout;
- Variables and their definitions;
- AgentReusableTools;
- Tool instances owned by those reusable configurations where applicable;
- references to Knowledge Spaces and other independent assets.

An Agent Template must not:

- copy a Knowledge Space or its documents;
- contain runtime values or execution state;
- contain secrets or credentials in exportable JSON;
- retain IDs that would collide with future instances;
- maintain a live link to the source Journey Agent.

When instantiated, all Agent-owned entity IDs and all Workflow Node/Edge IDs must be remapped consistently. Independent asset references such as Knowledge Space IDs remain references and are not deep-copied.

## 7. Current Configuration and Versioning

Odyssey V1 uses the current configuration as the sole editable and runnable configuration.

V1 does not require:

- WorkflowVersion records;
- version history;
- restore UI;
- Journey Release snapshots;
- publish/version selection for runtime.

The current configuration is authoritative. A future runtime would execute the current configuration until a separate release model is introduced.

The persistence model should therefore use current fields such as:

- current `PatternConfig` on the Journey;
- current `WorkflowGraph` on the AgentWorkflow;
- current `CanvasLayout` on the AgentWorkflow;
- current Variable and Tool configuration.

Records should retain an integer `revision` or equivalent optimistic concurrency mechanism so that an outdated editor session cannot silently overwrite newer data.

Autosave may persist ordinary editor changes after a debounce. Destructive operations such as Pattern replacement and Agent deletion always require explicit confirmation. The UI should expose `saving`, `saved`, `failed`, and `conflict` states.

`Save as Template` is not versioning. It creates a new reusable blueprint from the current instance.

## 8. Agent Workflow and Loop Constraints

### 8.1 Workflow boundary

An AgentWorkflow contains the current semantic graph and its separate presentation layout.

```text
AgentWorkflow
├─ WorkflowGraph
└─ CanvasLayout
```

`WorkflowGraph` must not contain top-level canvas coordinates or Vue Flow implementation objects. `CanvasLayout` must not define workflow execution semantics.

### 8.2 Loop body

A Loop owns an embedded sub-workflow. The Loop body does not create a separate AgentWorkflow database record.

Conceptually:

```ts
interface LoopNode {
  id: string
  type: 'loop'
  config: {
    exitCondition?: Condition
    maxTurns: number
    bodyGraph: WorkflowGraph
    bodyLayout: CanvasLayout
  }
}
```

The exact JSON shape may be refined in the canonical schema, but the ownership boundary is fixed: the nested graph belongs to the Loop node.

V1 Loop constraints:

- Agent Action is allowed inside a Loop.
- Task is allowed inside a Loop.
- Branch is allowed inside a Loop.
- Nested Loop is forbidden.
- Each Loop body remains acyclic.
- The Loop node introduces repetition; arbitrary graph cycles remain forbidden.

## 9. Tool Ownership

Odyssey distinguishes Tool templates, AgentReusableTools, and Task-owned Tool instances.

### 9.1 Tool Template

A Tool Template is a reusable component that may be instantiated in supported configuration contexts. It is independent from any one AgentWorkflow.

Built-in Tool Definitions describe the supported Tool types and schemas. A Tool Template provides reusable configured values for one of those definitions.

### 9.2 AgentReusableTool

An AgentReusableTool belongs to exactly one AgentWorkflow.

- It is reusable only within that AgentWorkflow's configuration process.
- It is not a workspace-global reusable asset.
- It cannot be referenced directly by another AgentWorkflow.
- Saving the owning Agent as an Agent Template includes its AgentReusableTools in the template snapshot.

### 9.3 Task Tool Instance

A Task owns an ordered linear sequence of configured Tool instances. These instances belong to the Task unless explicitly created from a supported template.

Tools are not independent Workflow nodes. Workflow-level routing remains the responsibility of Branch, Loop, and Workflow edges.

## 10. Knowledge Space Boundary

A Knowledge Space is an independent persistent asset.

- It is not owned by a Journey Agent.
- Multiple Journey Agents may reference the same Knowledge Space.
- Agent deletion and Pattern replacement must not delete a referenced Knowledge Space.
- Agent Template creation preserves Knowledge Space IDs as references and does not copy Knowledge Space content.
- Knowledge Space deletion requires reference checks against current Journey configurations and templates where applicable.

## 11. Persistence Categories

The canonical JSON and database design should use the following ownership categories.

### Current Journey state

- OdyJourney metadata;
- PatternConfig, Slots, and Routes;
- Journey AgentWorkflow instances;
- current WorkflowGraph and CanvasLayout;
- Variables;
- AgentReusableTools and owned Tool configuration;
- references to Knowledge Spaces.

### Reusable library state

- built-in Pattern templates;
- user-created Pattern templates;
- Agent templates;
- built-in Tool definitions;
- user-created Tool templates.

### Independent assets

- Knowledge Spaces;
- folders and document metadata;
- stored document objects;
- Knowledge Families and graph metadata where implemented.

### UI-only state

- selected Journey tab;
- selected Agent Slot;
- open Workflow Preview;
- selected Workflow Node;
- open configuration panel;
- Flow/Configure mode;
- Focus Mode;
- active drag session;
- unsaved form input before confirmation.

UI-only state must not become an independent backend entity. Only durable editor state required to restore the current configuration should be persisted.

## 12. V1 Out of Scope

- execution engine and runtime state;
- Workflow and Journey version history;
- publish and release selection;
- live template-instance synchronization;
- updating a source template from an instance;
- nested Loops;
- free-form Pattern routing;
- freely positioned built-in Pattern Slots;
- cross-AgentWorkflow AgentReusableTools;
- secrets embedded in reusable template JSON;
- multi-user collaboration and permissions.

