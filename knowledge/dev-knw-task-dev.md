---
description: "The task type task.dev@0.1 (the software development task): its fields, its stages and their rules, the close at reviewed or verified, and the WIP commit rule"
---

# Knowledge: The Type task.dev

`task.dev` is the software development task. It is a task type of version `0.1` that extends the base task. It adds two fields and four stages. Read this file before you create, do, review, or close a `task.dev` task. The general model is in [[dev-knw-task-model]].

## The Definition

```yaml
type: task.dev
version: "0.1"
extends: task
title: Software development task
fields:
  - { name: repo, label: Repository, kind: text }
  - { name: wipCommits, label: WIP commits, kind: list }
stages:
  - { name: scoped,   label: Scoped,   setBy: [agent, person], canClose: false }
  - { name: built,    label: Built,    setBy: [agent, person], canClose: false }
  - { name: reviewed, label: Reviewed, setBy: [agent, person], canClose: true }
  - { name: verified, label: Verified, setBy: [person],        canClose: true }
```

`ops task type show task.dev` shows the definition that Ops holds.

## The Fields

| Field | Kind | Meaning | How to set it |
|---|---|---|---|
| `repo` | text | The repository of the work, as a plain name (for example `main` or `flint`), until OrbRepo gives each repository a place | `ops task create … --type task.dev --repo <name>` (it also adds a `repo` related link), or `ops task field <ref> repo <name>` and then `ops task relate <ref> repo <name>` |
| `wipCommits` | list | The SHAs of the WIP commits. With many repositories, each value is `<sha> (<repo>)`. | Add: `ops task commit <ref> <sha> --repo <name>`. Remove one item: `ops task field <ref> wipCommits "<item>" --remove`, with the item exactly as it is stored (for example `1a2b3c4 (main)`). Never `set` the whole list to remove an item: a set loses an append of another session. |

## The Stages

| Stage | Meaning | Who sets it | Status change | Can close |
|---|---|---|---|---|
| `scoped` | The scope and the definition of done are in the task note | An agent or a person | None | No |
| `built` | The work is done and committed | An agent or a person | `todo` → `doing` | No |
| `reviewed` | A review checked the work against the task note | An agent or a person | `todo` → `doing` | Yes |
| `verified` | A person checked the work | **Only a person** | None | Yes |

- A new `task.dev` has no stage. Set `scoped` when the task note has the scope and the definition of done.
- After each stage write, run `flint shard task task-sync <ref>`: the note copies the stage (Ops owns it).
- Any stage can follow any stage. The order is for display. For example, a review that finds a fault sets `built` again after the fix.
- Each stage write adds a stage event with the actor. So Ops can prove that a person verified the work.
- **`verified` is only for a person.** An agent never sets `verified`. A write from an Orbh session (`ORBH_SESSION_ID` is set) refuses with `task_stage_forbidden`. Do not remove `ORBH_SESSION_ID` to pass the check: the mark is provenance, not security.
- **`reviewed` comes from a review.** The session that did the work sets `built`. A second session sets `reviewed` with [[dev-wkfl-task-review_task]].

## The Close

A `task.dev` closes with `completed` only at `reviewed` or `verified`:

| Ops shows | Meaning |
|---|---|
| `done · Reviewed` | A review checked the work. No person verified it. |
| `done · Verified` | A person verified the work. |

- A close with `completed` at `scoped`, at `built`, or with no stage refuses with `task_stage_not_closable`.
- `dropped` and `superseded` are allowed at any stage.
- A person can verify a task after its close at `reviewed`. Ops can list the tasks that closed at `reviewed`.

## A Type Change

Rule C4.8: `ops task retype <ref> task.dev` gives a task that is not done the type `task.dev`, and `ops task retype <ref> --none` makes it untyped. To untyped, the stage and the fields go, and the stage events stay. A done task refuses with `task_type_done`: reopen it first. The address follows the type, and the old address still resolves. The details are in [[dev-knw-task-cli]] § Type Change.

## The WIP Commit Rule

A `task.dev` records each commit of its work. The rules of OrbRepo stay: the machine branch, explicit staging, and no rewrite of history.

1. **Pin first.** The session pins the task (or its task group) before the first edit: `flint orbh task pin <ref>`.
2. **Check the branch.** Work on the machine branch of this machine (for example `nathan-main`). Never commit WIP to `dev` or `main`.
3. **Stage only your files.** `git commit -m "<message>" -- <path>...`. Never use `git add -A`, `git add .`, or `git commit -a`.
4. **The subject.** `[OR] wip: <Flint name>/Task <short id> <what changed>`. The Flint name has no `(Flint)` prefix (for example `NUU Flint`). The short id is the first 8 characters of the Ops id of the task. Add a short body that says what changed.
5. **The trailer.** The commit hook of Orbh adds `Task: <address>` from the pin, beside `Orbh-Fleet` and `Orbh-Session`. Do not write the trailer by hand. With no pin, the commit has no `Task:` trailer. With a task group pin, the trailer names the task group: then the subject names the task.
6. **Record the commit.** After each commit: `ops task commit <ref> <sha> --repo <name>`. This appends `<sha> (<repo>)` to `wipCommits`. Only a `task.dev` has this field (see § Commits of an Untyped Task). To remove a wrong item, use `ops task field <ref> wipCommits "<item>" --remove`, not a `set` of the whole list.
7. **Check the commit.** `git show --stat HEAD` must list only your paths.

Example:

```bash
git commit -m "[OR] wip: NUU Flint/Task jd7f3k2m the stage stepper of the task detail" \
  -m "The task detail shows the stages of the type and sets a stage with taskStages.set." \
  -- apps/nuu-ops/src/components/tasks/task-detail-dialog.tsx
ops task commit @v1/nuucognition/task.dev/jd7f3k2m9n8p4q5r6s7t8u9v0w1x2y3z#ops "$(git rev-parse --short HEAD)" --repo main
```

## Commits of an Untyped Task

An untyped task has no type fields, so it has no field `wipCommits`. `ops task commit` (and `ops task field`) on an untyped task refuses with `task_untyped`.

- The commit rules 1 to 5 and 7 stay: the pin, the machine branch, only your paths, the subject, the trailer, and the check.
- In place of rule 6, name the commits in the result of the task: `ops task result <ref> "<summary>. Commits: <sha> (<repo>), …"`.
- Work that changes code in a repository is usually a `task.dev`. Choose the type before the work. When an untyped task turns out to be a software task, retype it: `ops task retype <ref> task.dev --json`, then set its repository (`ops task field <ref> repo <name>` and `ops task relate <ref> repo <name>`). Use the `address` of the output from then on. Do not make a new task for it. Then record its commits with `ops task commit`.

## From a Flint Task File

The statuses of the Projects shard map to the status, the stage, and the outcome of `task.dev` (Notepad 237, turn `# 5`). Use the map when you move the work of a Flint task file to an Ops task.

| Task file status | Status | Stage | Outcome |
|---|---|---|---|
| `todo` | `todo` | `scoped` | — |
| `in-progress` | `doing` | `scoped` | — |
| `review`, `reviewing` | `doing` | `built` | — |
| `reviewed` | `doing` | `reviewed` | — |
| `done` | `done` | `verified` | `completed` |
| `blocked`, `deferred` | The status before, with the flag `blocked` | The stage before | — |
| `deprecated` | `done` | The stage before | `dropped` |
| `superseded` | `done` | The stage before | `superseded` |
