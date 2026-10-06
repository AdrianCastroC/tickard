---
name: readable-code
description: Enforce clean, consistently formatted, readable source code whenever creating, editing, refactoring, or reviewing code. Use for TypeScript, JavaScript, React, CSS, PHP, Laravel, C#, Java, Kotlin and similar source files.
---

# Readable Code

Use this skill whenever creating or modifying source code.

The goal is to produce production-quality code that is easy for a human developer to read, review, debug, and maintain.

## Core rule

Never sacrifice readability to reduce line count.

Code should look as if it had been written and formatted carefully by an experienced developer.

## One statement per line

Do not place multiple declarations or statements on the same line.

Bad:

```ts
const start = getStart(); const end = getEnd(); const days = buildDays(start, end);
```

Good:

```ts
const start = getStart();
const end = getEnd();
const days = buildDays(start, end);
```

## Functions

Do not compress functions containing logic onto one line.

Bad:

```ts
function shift(value: string, amount: number) { const date = parseDay(value); date.setUTCDate(date.getUTCDate() + amount); return dateKey(date); }
```

Good:

```ts
function shift(value: string, amount: number) {
  const date = parseDay(value);

  date.setUTCDate(date.getUTCDate() + amount);

  return dateKey(date);
}
```

Short trivial expressions may remain concise when they are genuinely clearer that way, but never compress multi-step logic.

## Conditionals

Use multiline formatting for non-trivial conditions.

Bad:

```ts
if (!cards.length) return { start: shift(today, -7), end: shift(today, 7) };
```

Prefer:

```ts
if (!cards.length) {
  return {
    start: shift(today, -7),
    end: shift(today, 7),
  };
}
```

## Objects

Format objects with several properties vertically.

Bad:

```ts
const config = { start, end, totalDays, minDaySize, zoom };
```

Prefer:

```ts
const config = {
  start,
  end,
  totalDays,
  minDaySize,
  zoom,
};
```

Small objects may remain inline only when that is clearly more readable.

## Function parameters

Do not create unreadably long function signatures.

Bad:

```ts
function TaskRow({ item, days, visibility, zoom, timelineStart, totalDays, onOpen }: { item: GanttCard; days: Day[]; visibility: ColumnVisibility; zoom: Zoom; timelineStart: string; totalDays: number; onOpen: (card: Card) => void }) {
```

Prefer defining a props type:

```ts
type TaskRowProps = {
  item: GanttCard;
  days: Day[];
  visibility: ColumnVisibility;
  zoom: Zoom;
  timelineStart: string;
  totalDays: number;
  onOpen: (card: Card) => void;
};

function TaskRow({
  item,
  days,
  visibility,
  zoom,
  timelineStart,
  totalDays,
  onOpen,
}: TaskRowProps) {
```

## React JSX

Format nested JSX structurally.

Bad:

```tsx
return <div className={styles.row}><button onClick={() => onOpen(card)}>{card.title}</button><div>{content}</div></div>;
```

Good:

```tsx
return (
  <div className={styles.row}>
    <button
      type="button"
      onClick={() => onOpen(card)}
    >
      {card.title}
    </button>

    <div>
      {content}
    </div>
  </div>
);
```

For components with several props, put props on separate lines.

## Ternaries

Avoid deeply nested or long inline ternaries.

Bad:

```ts
const label = zoom === 'day' ? 'Día' : zoom === 'week' ? 'Semana' : zoom === 'month' ? 'Mes' : 'Trimestre';
```

Prefer a mapping:

```ts
const ZOOM_LABELS: Record<Zoom, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
  quarter: 'Trimestre',
};

const label = ZOOM_LABELS[zoom];
```

## Long expressions

Break long expressions into meaningful intermediate variables.

Prefer:

```ts
const firstPlannedDate = getFirstPlannedDate(cards);
const lastPlannedDate = getLastPlannedDate(cards);

const timelineStart = shift(firstPlannedDate, -4);
const timelineEnd = shift(lastPlannedDate, 4);
```

instead of one very long expression.

Do not create meaningless temporary variables merely to satisfy this rule.

## TypeScript

Prefer explicit reusable types for complex component props.

Do not use `any` unless genuinely necessary.

Do not disable TypeScript checking to silence errors.

Do not add `@ts-ignore` or `@ts-nocheck` unless explicitly requested and justified.

## CSS

Write one property per line.

Bad:

```css
.row { display: grid; min-height: 30px; background: var(--surface); border-bottom: 1px solid var(--line); }
```

Good:

```css
.row {
  display: grid;
  min-height: 30px;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
}
```

Do not compress selectors or declaration blocks merely to reduce file size.

Group related properties sensibly.

## PHP

Follow the project's existing PHP formatting conventions.

For Laravel projects, use the repository's configured formatter when available.

Keep method bodies and fluent chains readable.

Long fluent chains should normally be split across lines.

## Existing project conventions

Before formatting:

1. Inspect the repository for formatter/linter configuration.
2. Follow the repository's established style.
3. Prefer the configured formatter over inventing a new style.
4. Do not add a new formatter dependency unless explicitly requested.
5. Do not reformat unrelated files.

Examples of configurations to respect include:

- Prettier
- ESLint
- Laravel Pint
- PHP-CS-Fixer
- EditorConfig
- language-specific formatter configuration

## Formatting after modifications

After editing code:

1. Run the formatter already configured for the affected files when available.
2. Run the relevant lint/type checks when practical.
3. Run `git diff --check`.
4. Inspect the final diff for compressed or unreadable code.

Formatting must happen before reporting completion.

## Diff discipline

Do not create large formatting-only diffs in unrelated code.

When touching an already poorly formatted function, it is acceptable to properly format that function while modifying it.

Do not reformat an entire repository unless explicitly requested.

## Comments

Do not add comments that merely repeat what the code says.

Use comments when they explain:

- architectural intent;
- non-obvious constraints;
- unusual business rules;
- why a solution is necessary.

## Naming

Prefer descriptive names.

Avoid unnecessary abbreviations.

Names should communicate purpose without needing a comment.

## Final readability check

Before completing a coding task, inspect every modified source file and verify:

- no multiple statements were compressed onto one line;
- no substantial function was compressed onto one line;
- JSX is properly nested and indented;
- complex props have readable formatting;
- CSS uses one declaration per line;
- long expressions are broken up sensibly;
- the repository's formatter has been respected;
- `git diff --check` passes.

If generated code is technically correct but unnecessarily difficult to read, the task is not complete.
