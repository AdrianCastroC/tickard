---
name: react-typescript
description: Enforce maintainable React and TypeScript patterns for frontend work, including typed props, clear component boundaries, reusable hooks, and readable JSX.
---

# React TypeScript

Use this skill whenever creating or editing React/TypeScript frontend code.

## Type safety

Prefer explicit reusable types.

Avoid:

- `any`;
- `@ts-ignore`;
- `@ts-nocheck`;
- unsafe casts used only to silence errors.

Fix the type or explain why a narrow cast is necessary.

## Component boundaries

Keep components focused.

Extract when a component mixes several independent responsibilities such as:

- data transformation;
- navigation;
- complex layout;
- reusable UI;
- side effects.

Do not split components merely to reduce line count.

## Props

For non-trivial components, define a named props type.

Prefer:

```ts
type TaskRowProps = {
  item: GanttCard;
  zoom: Zoom;
  onOpen: (card: Card) => void;
};
```

Avoid long inline prop type declarations inside function signatures.

## Hooks

Use hooks when they encapsulate reusable stateful behavior.

Do not create custom hooks for trivial one-line state.

Keep hook dependencies correct.

Do not suppress dependency warnings without justification.

## Derived state

Prefer deriving values from source state rather than storing duplicated derived state.

Use `useMemo` only when it provides a real benefit or stabilizes expensive/important derived structures.

Do not use `useMemo` mechanically.

## Effects

Use `useEffect` for synchronization with external systems.

Do not use effects for values that can be calculated during render.

Keep effects small and focused.

## JSX

Keep JSX structured and readable.

Extract complex conditional rendering when it becomes difficult to read.

Avoid deeply nested ternaries.

Prefer maps/constants for labels and configuration.

## Event handlers

Use descriptive handler functions when inline callbacks become complex.

Avoid embedding substantial business logic directly inside JSX.

## CSS Modules

Use the project's CSS Module conventions.

Do not introduce global CSS unless required.

Avoid layout fixes based on arbitrary offsets when Grid/Flexbox can express the structure directly.

## Reuse

Before creating a new component, helper, or hook, inspect whether an existing equivalent already exists.

Prefer reuse over duplication when responsibilities genuinely match.

## Imports

Keep imports clean and remove unused imports after changes.

Do not add dependencies unless the task actually requires them.

## Final checks

Use the repository formatter and frontend checks when available.

Run:

```bash
git diff --check
```

Do not report completion with new TypeScript errors introduced by the task.
