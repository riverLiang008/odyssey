# Workflow Canvas Mode Semantics Decision

> Status: Accepted
> Date: 2026-09-14
> Scope: Agent Workflow Canvas, including root and Loop-body canvases

## Decision

`Configure` is the default and complete authoring mode.

In Configure mode, users can:

- create Workflow nodes from the Palette by click or drag;
- move nodes on the Canvas;
- connect nodes and remove editable nodes or edges;
- inspect expanded node configuration;
- bind and unbind Tools and Knowledge Spaces;
- perform the same operations inside an expanded Loop body, subject to graph invariants.

`Flow` is a clean, read-only topology presentation mode. It keeps compact nodes and allows navigation, selection, pan, zoom, and inspection, but it does not allow graph or node-configuration mutation.

Newly opened Workflow Editor sessions start in Configure mode. Mode is session-only and is never persisted in the Agent Workflow aggregate.

## Capability matrix

| Capability | Configure | Flow |
| --- | --- | --- |
| Expanded node content | Yes | No |
| Palette create/click/drag | Yes | No |
| Move nodes | Yes | No |
| Connect nodes | Yes | No |
| Delete node/edge | Yes | No |
| Resource bind/unbind | Yes | No |
| Select/inspect | Yes | Yes |
| Pan/zoom | Yes | Yes |

## Superseded statements

This decision supersedes older M2.7/M2.8 planning and acceptance text that described Flow as the topology-editing mode and Configure as configuration-only or topology-locked. Historical reports remain historical evidence; future implementation and acceptance must use this matrix.
