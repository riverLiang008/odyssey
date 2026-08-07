# Odyssey Agent Variable UI Specification

## 1. Objective

Design the **Agent Variable** panel for the Agent-level workflow canvas.

The panel declares the state space available to an Agent and makes the ownership of each state explicit. Variable ownership determines whether a value may be changed by a user-configured Tool, by an Agent Action, by both, or only by Odyssey itself.

The UI should follow the structure and visual language of the attached draft while refining its hierarchy and interactions.

## 2. Design Principle: State Ownership

Agent Variables are not grouped only by technical write permission. Their groups represent **thinking ownership**:

- A **Tool mutation** is explicitly configured by the user. The state transition is therefore user-owned, even when the Tool executes automatically at runtime.
- An **Agent Action mutation** is decided by the Agent during reasoning. The timing and content of the state transition are therefore Agent-owned.
- A **System Variable** is supplied and maintained by Odyssey. Neither the user nor the Agent owns its mutation.

This distinction must remain visible in both the UI and runtime model.

## 3. Variable Definition and Runtime Value

Each variable has two layers:

1. **Variable definition** — name, type, description, optional default value, and ownership.
2. **Runtime value** — the actual value available during one execution.

The Agent Variable panel maintains variable definitions. Runtime values are produced naturally during execution:

- Odyssey injects System Variable values.
- User-configured Tools update variables where Tool mutation is permitted.
- Agent Actions update variables where Agent Action mutation is permitted.

There is no separate `Initialization` setting. A user-defined variable may optionally have a default value. Without one, its runtime value begins as `null` or undefined until an authorized runtime action supplies a value.

## 4. Panel Placement

- Keep **Agent Variable** as a top-level tab beside **Tool**, matching the draft.
- Selecting the tab opens a right-side panel inside the Agent workflow canvas.
- The panel belongs to the Agent configuration, not to an individual workflow node.
- Preserve the surrounding Agent Node, Knowledge Space, Toolbox, canvas controls, and visual language shown in the reference image.

## 5. Panel Structure

### Header

The panel header contains:

- Title: `Agent Variables`
- One primary action: `+ Add variable`
- Optional collapse or close control if required by the surrounding canvas pattern.

The add action creates only user-defined variables. It must never create a System Variable.

Do not place a separate add button inside each variable group.

### Variable Groups

Display four vertically stacked list containers. Each container may hold zero, one, or many compact variable rows.

#### A. System

System Variables are created and maintained by Odyssey.

- Users cannot create, rename, edit, or delete them.
- Tools cannot write them.
- Agent Actions cannot write them.
- Tools and Agent Actions may read and reference them.
- Their runtime values are automatically injected by Odyssey.

Suggested supporting label: `Provided by Odyssey · Read-only`

Use the `sys` namespace for references, for example:

```text
sys.current_message
sys.current_date
sys.current_datetime
sys.timezone
sys.session_id
sys.run_id
```

`sys.current_message` means the latest message received from the user. If the initial message needs to remain independently addressable, use `sys.initial_message`.

#### B. User-managed

User-managed variables represent state whose evolution is explicitly designed by the user.

- User-configured Tools may write them.
- Agent Actions may read them but cannot write them directly.
- A Tool mutation remains user-owned because the user explicitly configured the mutation rule.

Suggested supporting label: `Updated by configured Tools · Agent read-only`

Examples:

```text
is_reviewed
selected_format
validation_result
```

#### C. Shared

Shared variables represent collaboratively maintained state.

- User-configured Tools may write them.
- Agent Actions may also write them directly.
- The state may evolve through both user-designed workflow logic and Agent reasoning.

Suggested supporting label: `Updated by Tools and Agent Actions`

Examples:

```text
research_status
current_draft
open_questions
```

#### D. Agent-managed

Agent-managed variables provide a structured state space owned by the Agent's reasoning process.

- Agent Actions may write them directly.
- User-configured Tools cannot write them.
- The user still defines the variable schema, but the Agent decides what value to store and when to update it.

Suggested supporting label: `Maintained by Agent Actions`

Examples:

```text
working_plan
current_hypothesis
uncertainties
next_step
```

### Permission Matrix

| Variable group | Tool read | Tool write | Agent Action read | Agent Action write | Thinking ownership |
| --- | ---: | ---: | ---: | ---: | --- |
| System | Yes | No | Yes | No | Odyssey |
| User-managed | Yes | Yes | Yes | No | User |
| Shared | Yes | Yes | Yes | Yes | User + Agent |
| Agent-managed | Yes | No | Yes | Yes | Agent |

## 6. Variable Row

Use compact rows inside each group rather than large cards for individual variables.

Each row may show:

- Variable reference or name.
- Data type.
- Default value badge or short preview when present.
- Short description when space permits.
- Ownership or lock badge.
- Edit action for user-defined variables.
- More menu for duplicate and delete actions where allowed.

Example:

```text
sys.current_message    String                   Locked
is_reviewed            Boolean    Default: false
research_status        Object
working_plan           Object
```

System Variable rows do not show edit, duplicate, or delete actions. Clicking one opens a read-only detail view with a `Copy reference` action.

## 7. Add/Edit Variable Form

Clicking `+ Add variable` opens a form in the same side panel, a nested drawer, or a modal consistent with Odyssey's interaction language.

### Variable Name

- Required.
- Must be unique within the Agent.
- Use an identifier-safe format such as `snake_case`.
- The `sys` namespace is reserved and cannot be used for user-defined variables.
- Show the eventual reference form, for example `agent.research_status`.

### Data Type

Required dropdown. Initial supported options:

- String
- Number
- Boolean
- Object
- Array
- Document Reference

### Description

- Optional multiline input.
- Explain what the variable represents and how it should be used.
- For Shared and Agent-managed variables, the description also acts as guidance for Agent Actions deciding when and how to update the value.

### Default Value

- Optional.
- The editor adapts to the selected data type.
- If omitted, the runtime value begins as `null` or undefined.
- Do not show a separate Initialization selector.
- Changing the data type must revalidate the default value.

### State Ownership

Provide one selection:

- **User-managed** — updated only through explicitly configured Tools; Agent Actions are read-only.
- **Shared** — updated through Tools or Agent Actions.
- **Agent-managed** — updated directly by Agent Actions; Tools are read-only.

Use the label `State Ownership`, not `Write Access`, because the option describes who owns the state transition rather than only a storage permission.

### Form Actions

- Primary: `Create variable` or `Save changes`
- Secondary: `Cancel`
- Destructive edit action: `Delete variable`

Disable the primary action until all required fields are valid.

## 8. Automatic Grouping

User-defined variables are automatically grouped according to `ownership`:

| Ownership | Destination group |
| --- | --- |
| `user_managed` | User-managed |
| `shared` | Shared |
| `agent_managed` | Agent-managed |

System Variables always appear in the System group and cannot change ownership.

Users do not manually drag variables between groups. When ownership changes:

1. Save the updated definition.
2. Move the row to the corresponding group.
3. Use a subtle transition so the movement is understandable.
4. Optionally show a temporary confirmation such as `Moved to Shared`.

## 9. Mutation Behavior

### Tool Mutation

A Tool changes a variable only when the user explicitly configures that Tool output or operation to target the variable.

When configuring a Tool mutation:

- Show only User-managed and Shared variables as writable targets.
- System and Agent-managed variables may be read but cannot be selected as write targets.
- Specify the operation, target variable, and value source explicitly.

Example operations:

- Set value
- Update object field
- Append to array
- Clear value

### Agent Action Mutation

An Agent Action may directly update Shared and Agent-managed variables as part of its reasoning.

- User-managed and System variables remain read-only.
- The Agent decides whether an update is needed, when it occurs, and what value to store.
- Variable descriptions and types constrain and guide this behavior.
- Updates should be represented as structured state patches rather than invisible internal mutations.

Example runtime record:

```json
{
  "variableUpdates": [
    {
      "variable": "agent.current_hypothesis",
      "operation": "set",
      "value": "A newly inferred hypothesis"
    }
  ]
}
```

Both Tool mutations and Agent Action mutations must appear in execution traces for debugging and replay. Their difference is who owns the decision, not whether the mutation is observable.

## 10. System Variable Detail View

Clicking a System Variable opens a read-only detail view containing:

- Full reference name.
- Data type.
- Description.
- Runtime semantics.
- Availability or scope.
- `Copy reference` action.
- `Built-in` and `Read-only` badges.

Example:

```text
sys.current_message                         Copy reference

Type
String

Description
The latest message received from the user.

Scope
Current interaction

Access
Read-only
```

Avoid presenting System Variables as disabled form inputs. A read-only information view communicates that they are intentionally fixed rather than temporarily unavailable.

## 11. Reference Integrity

Variables may be referenced by Tools, Agent Actions, prompts, or workflow nodes. Protect those references.

### Rename

- Detect existing references.
- Update references automatically when safe.
- Show how many references will be affected before confirmation.

### Delete

- Detect existing references.
- Show affected Tools or nodes.
- Do not silently delete a referenced variable.

### Type Change

- Warn when the new type invalidates a default value or an existing binding.
- Require invalid references to be resolved before saving when necessary.

System Variables cannot be renamed, deleted, or have their types changed.

## 12. Visual Direction

- Preserve the draft's vertically stacked list-container structure.
- Add a visually distinct System section, preferably above the three ownership sections.
- Use restrained color accents rather than saturated full backgrounds.
- Do not use red as the standard color for Agent-managed variables because red conventionally communicates an error or destructive state.
- Suggested accents:
  - System: neutral gray or slate.
  - User-managed: green or teal.
  - Shared: amber or warm yellow.
  - Agent-managed: blue or violet.
- Do not rely on color alone. Every group needs a title, supporting label, and ownership or lock icon.
- Allow sections to collapse if the complete panel becomes too long.
- Keep rows dense enough to support approximately 10–20 variables without excessive scrolling.
- Use consistent spacing, border radius, typography, and icon style with the existing Odyssey canvas.

## 13. Important UI States

Create designs for:

1. Panel with variables in all four groups.
2. Completely empty user-defined sections while System Variables remain visible.
3. One empty ownership group among populated groups.
4. Add-variable form.
5. Edit-variable form.
6. Read-only System Variable detail view.
7. Validation error for a duplicate, invalid, or reserved name.
8. Variable moving to another group after ownership changes.
9. Delete confirmation with existing references.
10. Collapsed and expanded group states.

## 14. Example Content for the Mockup

### System

| Reference | Type | Description |
| --- | --- | --- |
| `sys.current_message` | String | Latest message received from the user. |
| `sys.current_date` | String/Date | Current date in the active user timezone. |
| `sys.timezone` | String | Timezone used for date and time values. |
| `sys.run_id` | String | Identifier of the current execution. |

### User-managed

| Name | Type | Default value | Description |
| --- | --- | --- | --- |
| `target_language` | String | `English` | Preferred language for generated content. |
| `is_reviewed` | Boolean | `false` | Review state updated through a configured Tool. |

### Shared

| Name | Type | Default value | Description |
| --- | --- | --- | --- |
| `research_status` | Object | — | Progress maintained by workflow Tools and Agent reasoning. |
| `current_draft` | Document Reference | — | Draft updated through explicit operations or Agent Actions. |

### Agent-managed

| Name | Type | Default value | Description |
| --- | --- | --- | --- |
| `working_plan` | Object | — | Working plan maintained by the Agent. |
| `current_hypothesis` | String | — | Current hypothesis formed during reasoning. |

## 15. Suggested Data Structure

```ts
type VariableType =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array"
  | "document_reference";

type SystemVariable = {
  source: "system";
  name: `sys.${string}`;
  type: VariableType;
  description: string;
  scope: "interaction" | "session" | "run";
  ownership: "system";
};

type UserDefinedAgentVariable = {
  id: string;
  source: "user";
  name: string;
  type: VariableType;
  description?: string;
  defaultValue?: unknown;
  ownership: "user_managed" | "shared" | "agent_managed";
};

type AgentVariable = SystemVariable | UserDefinedAgentVariable;
```

Runtime permissions may be derived from ownership:

```ts
const variablePermissions = {
  system: {
    toolWrite: false,
    agentActionWrite: false,
  },
  user_managed: {
    toolWrite: true,
    agentActionWrite: false,
  },
  shared: {
    toolWrite: true,
    agentActionWrite: true,
  },
  agent_managed: {
    toolWrite: false,
    agentActionWrite: true,
  },
} as const;
```

## 16. Acceptance Criteria

- There is one global `Add variable` entry point.
- The panel displays System, User-managed, Shared, and Agent-managed sections.
- System Variables are visible but cannot be created, edited, renamed, or deleted.
- `sys.current_message` is available as the latest user message.
- User-defined variables have an optional default value and no Initialization selector.
- The form uses `State Ownership` rather than `Write Access`.
- Variables are automatically grouped by ownership.
- Tool configuration can write only User-managed and Shared variables.
- Agent Actions can write only Shared and Agent-managed variables.
- All mutations are traceable even when the Agent owns the update decision.
- Ownership changes automatically move the variable to the correct group.
- Rename, delete, and type changes account for existing references.
- The UI remains usable with empty groups and with approximately 10–20 variables.

## 17. Scope Note

The user defines the schema of all non-system Agent Variables. Agent-managed ownership does not mean the Agent may create arbitrary top-level variables at runtime. It means the Agent may decide how and when to update values within the predefined Agent-managed state space.

This preserves schema validation and inspectability while still giving the Agent meaningful ownership of its internal reasoning state.
