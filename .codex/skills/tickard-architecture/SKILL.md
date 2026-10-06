---
name: tickard-architecture
description: Preserve Tickard project architecture and product structure when modifying frontend or backend code.
---

# Tickard Architecture

Use this skill for work inside the Tickard repository.

## Core product hierarchy

Tickard uses:

```text
Workspace
  -> Project
    -> Board
      -> Column
        -> Card
```

Do not flatten or bypass this hierarchy unless explicitly requested.

## Workspace

A Workspace is the main organizational context.

Workspace-level data and navigation must remain distinct from individual Project and Board contexts.

## Project

A Project belongs to a Workspace.

Project-level views can include project-wide information such as:

- boards;
- roadmap;
- Gantt;
- project navigation.

## Board

A Board belongs to a Project.

Board views operate on Board-level Cards and Columns.

Board-specific Gantt hierarchy:

```text
Category
  -> Card
```

Future Project Gantt hierarchy:

```text
Board
  -> Category
    -> Card
```

## Navigation rules

Global navigation includes:

- Inicio;
- Bandeja;
- Mis tareas.

The Workspace selector is separate from global navigation.

Top project tabs represent opened Projects.

Project tabs appear only in Project/Board context, not in global views such as:

- Inicio;
- Bandeja;
- Mis tareas;
- Workspace overview.

Board context keeps the Project tabs visible.

Project-level and Board-level navigation must remain distinct.

## Layout rules

Avoid duplicating shell/layout logic inside feature components.

Prefer shared layout components for:

- Workspace context;
- Project context;
- Board context.

Feature components should not recreate global navigation.

## Gantt architecture

The temporal axis should use one coherent coordinate system.

Do not mix:

- CSS Grid coordinates;
- manually calculated pixel positions;
- multiple independent temporal grids.

For Board Gantt, all temporal rows should share the same underlying timeline definition.

Dates, summaries, headers and future dependencies should align to the same axis.

## Backend/frontend boundaries

Frontend must not encode backend business rules that already belong to the API/domain layer.

Backend changes should preserve existing API contracts unless the task explicitly requires a contract change.

## Plans and access

Do not change plan/access rules casually.

If a task touches plan-gated features, inspect existing plan rules before modifying behavior.

## Documentation

When architecture or product rules change materially, update the relevant documentation if the task includes documentation work or if the change would otherwise leave documentation misleading.

## Scope

Do not invent new Tickard behavior.

If a requirement is unclear, preserve current documented/project behavior rather than guessing.
