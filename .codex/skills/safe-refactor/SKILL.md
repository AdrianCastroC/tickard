---
name: safe-refactor
description: Apply safe, architecture-aware refactors. Use when replacing systems, reorganizing code, changing layout engines, extracting modules, or modifying shared behavior.
---

# Safe Refactor

Use this skill whenever a task changes existing architecture or replaces an existing implementation.

## Core rule

Fix causes, not symptoms.

Do not compensate for an architectural problem with offsets, arbitrary widths, duplicated state, negative margins, magic numbers, or parallel systems.

## Before editing

Inspect the relevant code first.

Identify:

- current source of truth;
- data flow;
- layout/architecture boundaries;
- duplicated implementations;
- legacy code that will become obsolete;
- files affected by the change.

Do not start modifying code until the current structure is understood.

## One system of truth

When a new system replaces an old one, do not leave both active.

Examples:

- new Grid layout replaces pixel-based positioning;
- new state store replaces local duplicated state;
- new API layer replaces direct fetch calls.

After the migration, remove obsolete code that belongs to the old system.

## Avoid patches

Do not solve structural problems with:

- arbitrary `calc()` values;
- unexplained offsets;
- fixed pixel compensation;
- negative margins;
- duplicate layout calculations;
- duplicate date calculations;
- CSS `!important` used to fight conflicting architecture;
- hidden legacy code that still controls behavior.

If a patch seems necessary, first determine whether the underlying architecture is wrong.

## Scope discipline

Change only what is required for the requested refactor.

Do not:

- refactor unrelated modules;
- rename unrelated files;
- reformat the entire repository;
- change APIs without need;
- modify backend when the task is frontend-only.

## Preserve behavior

Unless explicitly requested otherwise, preserve:

- public interfaces;
- visible behavior;
- data contracts;
- routes;
- persisted data;
- user interactions.

## Remove obsolete code

After the new implementation works, search for obsolete:

- helpers;
- constants;
- CSS rules;
- props;
- state;
- event handlers;
- temporary compatibility logic.

Remove them when they are no longer used.

## Validate architecture

Before finishing, verify that:

- there is a single source of truth;
- old and new systems are not both active;
- shared behavior is actually shared;
- duplicated calculations are removed;
- affected components use the intended architecture.

## Final checks

Run the formatter/linter configured by the project when available.

Run:

```bash
git diff --check
```

Inspect the diff before reporting completion.

If the code compiles but the old architecture is still partially active, the refactor is not complete.
