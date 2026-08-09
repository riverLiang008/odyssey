# Odyssey Repository Instructions

## Frontend work

Before performing any frontend implementation, modification, refactor, debugging, or code review in this repository, you MUST read the following document completely:

- `doc/frontend-engineering-guidelines.md`

The document is the repository's authoritative frontend engineering guideline. Apply its architecture boundaries, state-management rules, TypeScript requirements, Canvas and drag-and-drop constraints, asynchronous-safety rules, testing requirements, Definition of Done, and code-review checklist throughout the task.

Do not rely on a prior summary or a previous conversation's memory in place of reading the current file. Re-read the complete file at the start of every frontend coding or frontend code-review task so updates to the guideline are respected.

If a requested frontend change conflicts with the guideline:

1. identify the conflict explicitly;
2. prefer a compliant implementation when it still satisfies the user's intent;
3. if an exception is genuinely required, document it using the guideline's "架构例外" requirements;
4. do not silently bypass the rule with direct state mutation, weak typing, duplicated state, or third-party view-model leakage.

For work scoped entirely outside the frontend, reading this document is not required unless the change affects frontend contracts, persisted editor state, or frontend architecture boundaries.
