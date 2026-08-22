Update the OdyJourney **System Configuration / Execution page** to match the latest interaction design for **Input Guardrail** and **Output Guardrail**.

## Goal

Input Guardrail and Output Guardrail should be treated as **optional system modules**.

They are **not configurable Patterns** and users should not be able to switch their Pattern.

When enabled, each Guardrail uses a fixed **Single Agent structure** internally.

The main Execution module still uses the Pattern selected when the OdyJourney was created, e.g. Hub and Spoke / Circular Loop / Linear Sequence / Solo Component.

---

## 1. Default / Inactive Guardrail State

For both:

- Input Guardrail
    
- Output Guardrail
    

Default state should be inactive.

Visual structure:

- Keep the current muted / inactive card style.
    
- Show the module title.
    
- Show small secondary text: `Optional`
    
- Show a centered circular `+` button.
    
- Below the plus button, show text:
    

`Add`

Do **not** show:

- `Linear Pattern`
    
- `Linear Sequence`
    
- `Ordered guardrail chain`
    
- any Pattern selector
    
- any draggable Pattern interaction
    

The Guardrail should visually communicate:

> This module is available, but has not been added yet.

---

## 2. Add Interaction

Clicking the `+` button or the `Add` label should enable the Guardrail.

After enabling:

- The Guardrail becomes an active module.
    
- Its visual state should match the active language used by the Execution module where appropriate, e.g. stronger border / active highlight.
    
- Automatically create exactly **one Guardrail Agent**.
    
- Internally treat the Guardrail structure as fixed `single`.
    
- Do not ask the user to select a Pattern.
    

Conceptually:

```text
Input Guardrail
    ↓
Guardrail Agent
    ↓
Execution
```

and:

```text
Execution
    ↓
Guardrail Agent
    ↓
Output
```

---

## 3. Active Guardrail State

Once enabled, replace the Add UI with a single Agent representation.

Reuse the existing Agent Slot visual language where possible.

Example:

```text
Input Guardrail

      A
Guardrail Agent
  Configured
```

The Guardrail Agent should behave like a normal Odyssey Agent in terms of workflow configuration.

Clicking the Agent should reuse the existing Agent workflow interaction:

- workflow preview
    
- open workflow / canvas
    
- existing Agent configuration logic where possible
    

Do not implement a separate Guardrail workflow system unless necessary.

Prefer reuse of the current Agent / Workflow components and data model.

---

## 4. Remove Interaction

Do not show a permanent Delete button in the inactive/active card.

For an active Guardrail, expose removal as a secondary action, preferably through the existing contextual `...` menu.

Suggested action:

`Remove guardrail`

When removed:

- delete / detach the Guardrail Agent configuration
    
- restore the Guardrail card to the inactive state
    
- show `Optional`
    
- show the centered `+`
    
- show `Add`
    

---

## 5. Data Model / Constraints

Please preserve the following conceptual rules:

### Execution

```text
execution.pattern = user-selected Pattern
```

The Pattern is selected during OdyJourney creation and should remain fixed afterward.

### Guardrail

Conceptually the Guardrail can be represented as something like:

```ts
inputGuardrail?: {
  enabled: boolean
  pattern: 'single'
  agent: AgentConfig
}

outputGuardrail?: {
  enabled: boolean
  pattern: 'single'
  agent: AgentConfig
}
```

The exact implementation should follow the existing project architecture rather than introducing this exact interface if a better structure already exists.

Important constraints:

- Guardrail Pattern is always `single`.
    
- Guardrail Pattern is not user-selectable.
    
- Input and Output Guardrails are independently optional.
    
- There can be at most one Agent in each Guardrail.
    
- Execution Pattern and Guardrail structure must remain separate concepts.
    

---

## 6. Do Not Change

Please avoid unrelated refactoring.

Do not change:

- OdyJourney creation Pattern selection
    
- Execution Pattern rendering
    
- existing Execution Agent behavior
    
- Behavior module
    
- general page layout unless required for this interaction
    

Reuse existing styles, tokens, Agent components, context-menu logic, and workflow-preview logic wherever possible.

---

## Expected Result

The System Configuration page should visually behave like:

```text
[ Input Guardrail ]    [ Execution · Hub and Spoke ]    [ Output Guardrail ]

     Optional                  existing agents                 Optional

        +                                                       +
       Add                                                     Add
```

After enabling Input Guardrail:

```text
[ Input Guardrail ]    [ Execution · Hub and Spoke ]    [ Output Guardrail ]

        A                      existing agents                 Optional
 Guardrail Agent                                               +
   Configured                                                  Add
```

The key UX principle is:

**Add is a primary discoverable action. Remove is a secondary contextual action.**

And the key conceptual principle is:

**Guardrails reuse the Agent + Workflow execution primitive, but their structural role is fixed as a single-agent boundary module rather than a user-selectable Pattern.**