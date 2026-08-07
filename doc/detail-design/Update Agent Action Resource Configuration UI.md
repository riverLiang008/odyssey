# Update Agent Action Resource Configuration UI

Please update the Agent Action configuration UI according to the following design.

## Background

An Agent Action can use two types of resources:

- Tools
- Knowledge Spaces
    

Both Tools and Knowledge Spaces should follow the same interaction pattern.

The user should primarily configure these resources through a searchable and filterable resource bar above the workflow canvas, then drag selected resources into the corresponding section of an Agent Action node.

Do not use a conventional dropdown as the primary resource-selection interaction.

---

## 1. Top Resource Bar

Add a collapsible resource browser above the Agent Workflow Canvas.

The resource browser should contain two resource categories:

- Tools
- Knowledge Spaces
    

Example layout:

```text
┌────────────────────────────────────────────────────────────┐
│ Resources                                                  │
│                                                            │
│ [ Tools ] [ Knowledge Spaces ]                             │
│                                                            │
│ [ Search resources... ]   [ Filter ]   [ Previous ] [ Next ]│
│                                                            │
│ Search Tool   Read File   Browser   Paper KS   Project KS  │
└────────────────────────────────────────────────────────────┘
```

Only resources belonging to the currently selected category should be displayed.

When `Tools` is selected, show available Tools.

When `Knowledge Spaces` is selected, show available Knowledge Spaces.

---

## 2. Search

The resource bar must support keyword search.

Search should filter resources within the currently selected category.

For example:

```text
Selected category: Knowledge Spaces
Search query: paper
```

Possible results:

```text
Paper Research
Paper Drafts
Paper References
```

Search should match at least:

- Resource name
    
- Resource description
    
- Resource tags, if tags are currently available
    

If tags or descriptions are not yet part of the data model, implement name-based search first.

---

## 3. Filtering

Add lightweight filtering where supported by the existing data model.

Possible filters include:

- All
- Recent
- Favorites
- Built-in
- User-created
- Community

Do not invent unsupported backend fields.

If only a limited resource model currently exists, implement the filtering UI in a way that can be extended later, but only expose filters supported by the current data.

---

## 4. Pagination

The resource list should support compact pagination.

The resource bar should display only a limited number of resource cards at one time.

Provide:

- Previous page
- Next page
- Current page indicator
    

Example:

```text
‹  1 / 4  ›
```

Pagination should work together with search and filters.

When the user changes the search query, category, or filter, reset pagination to the first page.

---

## 5. Resource Cards

Each Tool or Knowledge Space should appear as a compact draggable card.

A resource card should display:

- Resource icon
- Resource name
- Resource type
- Optional short description or tag

Example:

```text
┌──────────────────┐
│ 🔧 Search Tool   │
│ Tool             │
└──────────────────┘
```

```text
┌──────────────────┐
│ 📚 Paper Research│
│ Knowledge Space  │
└──────────────────┘
```

The cards should be compact enough to fit inside the horizontal resource browser.

---

## 6. Drag and Drop

Users should be able to drag resources from the resource bar into an Agent Action node.

An Agent Action node contains separate drop zones for:

- Knowledge Spaces
- Tools

Example:

```text
┌────────────────────────────────┐
│ Agent Action                   │
│ Analyze Research Draft         │
│                                │
│ Knowledge Spaces               │
│ [ Paper Research ]             │
│ [ + Drop Knowledge Space ]     │
│                                │
│ Tools                          │
│ [ Search ] [ Read File ]       │
│ [ + Drop Tool ]                │
└────────────────────────────────┘
```

A Tool can only be dropped into the Tools section.

A Knowledge Space can only be dropped into the Knowledge Spaces section.

Invalid drops should be rejected and should provide clear visual feedback.

---

## 7. Drop-Zone States

Each resource section should support the following visual states:

### Empty

```text
Drop Knowledge Space here
```

or:

```text
Drop Tool here
```

### Drag Over

Highlight the valid drop zone when a compatible resource is dragged over it.

### Invalid Drag

Do not highlight incompatible drop zones.

Optionally show a blocked cursor or short invalid-drop indication.

### Configured

Display added resources as chips, pills, or compact resource items.

Example:

```text
Knowledge Spaces
[ Paper Research × ]
[ Product Documents × ]
```

```text
Tools
[ Search × ]
[ Read File × ]
```

Users should be able to remove a resource through the remove icon.

---

## 8. Duplicate Handling

Do not allow the same Tool or Knowledge Space to be added to the same Agent Action more than once.

If the user attempts to add a duplicate resource:

- Do not add another copy.
- Briefly highlight the existing resource.
- Optionally show a small message such as `Already added`.

---

## 9. Agent Action Side Panel

The side panel should still be used for detailed Agent Action configuration.

Clicking an Agent Action node should open the configuration side panel.

The side panel should contain:

- Goal
- Knowledge Spaces
- Tools
- Other Agent Action settings that already exist
    

However, the side panel is not the primary resource discovery interface.

The resources selected through drag and drop must be reflected in the side panel.

Resources added or removed from the side panel must also be reflected on the Agent Action node.

Both interfaces should edit the same underlying state.

Do not maintain two independent resource configurations.

---

## 10. Resource Configuration Boundary

Dragging a resource into an Agent Action means:

```text
Bind this resource to the Agent Action.
```

It does not necessarily mean:

```text
Fully configure this resource instance.
```

If a Tool requires additional configuration, such as parameters or credentials, clicking the Tool inside the Agent Action should open its detailed configuration in the side panel or an existing configuration panel.

Knowledge Spaces should follow the same interaction pattern where applicable.

For example, clicking a bound Knowledge Space may show:

- Selected Knowledge Space
- Included scope
- Tags or document groups
- Access mode
    

Only display settings already supported by the current product model.

---

## 11. Interaction Consistency

Tools and Knowledge Spaces should use the same interaction model:

```text
Browse
→ Search or filter
→ Drag into Agent Action
→ Display inside node
→ Configure details in side panel
```

Do not implement Tool selection and Knowledge Space selection using two unrelated UI patterns.

They may use different icons or colors, but they should share the same layout, drag behavior, search behavior, pagination behavior, and removal behavior.

---

## 12. Canvas Readability

The Agent Action node should not expand indefinitely as resources are added.

When the number of configured resources exceeds the available display space:

- Show only the first few resource items.
- Display a summary such as `+3 more`.
- Allow the user to inspect the full list through the side panel.
    

Example:

```text
Tools
[ Search ] [ Read File ] [ +3 more ]
```

This is important because the canvas should remain readable as a workflow diagram.

---

## 13. Suggested Component Structure

Reuse existing project conventions where possible.

A possible component breakdown is:

```text
AgentWorkflowCanvas
├── ResourceBrowser
│   ├── ResourceCategoryTabs
│   ├── ResourceSearch
│   ├── ResourceFilters
│   ├── ResourcePagination
│   └── ResourceCard
│
├── AgentActionNode
│   ├── AgentActionHeader
│   ├── KnowledgeSpaceDropZone
│   ├── ToolDropZone
│   └── ResourceSummary
│
└── AgentActionSidePanel
    ├── GoalConfiguration
    ├── KnowledgeSpaceConfiguration
    └── ToolConfiguration
```

This structure is only a suggestion. Follow the existing architecture and component conventions of the repository.

---

## 14. State Model

The Agent Action should store references to selected resources.

Conceptually:

```ts
interface AgentActionConfig {
  goal: string;
  knowledgeSpaceIds: string[];
  toolIds: string[];
}
```

Use the existing project types and field names if equivalent structures already exist.

Do not introduce duplicate state specifically for the canvas and side panel.

The resource browser, Agent Action node, and side panel must all derive their display from the same Agent Action configuration.

---

## 15. Acceptance Criteria

The implementation is complete when:

1. The canvas has a collapsible resource browser.
2. Users can switch between Tools and Knowledge Spaces.
3. Both resource types support search.
4. The resource list supports compact pagination.
5. Supported filters work together with search and pagination.
6. Tool and Knowledge Space cards are draggable.
7. Tools can be dropped only into the Tool section.
8. Knowledge Spaces can be dropped only into the Knowledge Space section.
9. Added resources are visible inside the Agent Action node.
10. Duplicate resources cannot be added.
11. Resources can be removed from the node.
12. The Agent Action side panel reflects the same resource configuration.
13. Changes made in the side panel are reflected on the node.
14. Nodes remain compact when many resources are configured.
15. Existing canvas interactions and workflow connections are not broken.
    

---

## 16. Implementation Constraints

Before making changes:

1. Inspect the current canvas, node, drag-and-drop, state-management, and side-panel implementations.
2. Reuse existing components and styling conventions where possible.
3. Do not rewrite unrelated canvas code.
4. Do not change the existing workflow execution semantics.
5. Keep the implementation scoped to Agent Action resource selection and display.
6. Preserve existing responsive behavior and theme support.
7. Run the existing lint, type-check, test, and build commands after the change.
    

At the end, summarize:

- Files changed
- Main UI behavior added
- State-model changes
- Any assumptions
- Any unfinished backend-dependent behavior