---
name: verify-before-done
description: Require concrete verification of requested behavior before declaring a coding task complete.
---

# Verify Before Done

Use this skill for implementation, refactor, bug-fix, and UI tasks.

## Core rule

Compilation alone is not proof that the task is correct.

Do not report "done" until the requested behavior has been checked against explicit acceptance criteria.

## Build acceptance criteria first

Before editing, identify what must be true when the task is finished.

For each requested behavior, define a concrete verification.

Examples:

- layout alignment;
- correct dates;
- correct visibility;
- persistence;
- navigation;
- responsive behavior;
- no legacy code path remaining.

## Verify the actual request

Check the exact behavior the user asked for.

Do not substitute:

- successful compilation;
- successful type checking;
- lack of runtime exceptions;

for behavioral verification.

## UI tasks

For UI/layout work, verify relevant states such as:

- different viewport widths;
- empty state;
- short content;
- long content;
- collapsed/expanded state;
- relevant zoom or view modes;
- scrolling.

For Gantt work, verify at least the affected zoom modes and alignment between:

- header;
- categories;
- task rows;
- summary bars;
- timeline separators.

## Refactors

After a replacement refactor, search for leftovers from the old system.

Verify obsolete code is not still controlling part of the behavior.

Examples:

- old width calculations;
- old positioning helpers;
- old CSS backgrounds;
- duplicate state;
- legacy props.

## Existing errors

Do not fix unrelated pre-existing errors unless requested.

Clearly distinguish:

- errors introduced by the current task;
- errors that already existed.

## Checks

Use the project's available checks.

At minimum, run:

```bash
git diff --check
```

Run formatter, lint, type checks, tests, or build when relevant and available.

## Final report

Do not say only "completed".

Report:

- what changed;
- what was verified;
- which checks passed;
- any remaining known limitation;
- any pre-existing errors that remain.

If a requested behavior was not verified, say so explicitly.
