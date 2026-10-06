---
name: git-discipline
description: Apply safe Git workflow rules when editing the repository, preparing commits, reviewing diffs, or pushing changes.
---

# Git Discipline

Use this skill for repository changes and Git operations.

## No implicit commit or push

Do not commit or push unless the user explicitly requests it.

Editing files does not imply permission to commit.

Committing does not imply permission to push.

## Before commit

Before creating a commit:

1. inspect `git status`;
2. inspect the relevant diff;
3. ensure unrelated files are excluded;
4. run available checks;
5. run `git diff --check`.

## Commit scope

Commits should be small and coherent.

Do not mix:

- unrelated refactors;
- formatting-only changes;
- feature work;
- documentation changes;

unless they are part of the same requested task.

## Commit messages

Use concise Conventional Commit style when appropriate.

Examples:

```text
feat: add project gantt view
fix: align gantt timeline columns
refactor: unify gantt timeline grid
docs: define workspace rules
```

## Do not rewrite history casually

Do not use destructive Git operations unless explicitly requested.

Avoid:

- `reset --hard`;
- forced pushes;
- rewriting shared history;
- deleting branches;

without explicit approval.

## Working tree awareness

Never assume uncommitted local changes are present in remote GitHub.

Distinguish clearly between:

- working tree;
- local commits;
- pushed commits.

## After commit

Report:

- commit hash;
- commit message;
- files included;
- whether push was performed.

## Push

Push only when explicitly requested.

If pushing, verify the target branch and remote first.

## Final state

After requested Git operations, report whether the working tree is clean or still contains pending changes.
