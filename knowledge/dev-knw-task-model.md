---
description: "The task model of NUU Ops and the Tasks shard: the two parts of a task (the task note and the Ops task), the terms, the fields, the status and the outcome, task types and stages, the close rules, lineage, task groups, placement, attachments, and addresses"
---

# Knowledge: The Task Model

This file is the model of the task primitive v0.1 (Notepad 237, Task 1287, sections C0 to C5 of its contract), with the task notes of Task 1291 (contract N). Read it before you create, change, or close a task. The commands are in [[dev-knw-task-cli]]. The rules of the type `task.dev` are in [[dev-knw-task-dev]].

## Terms

| Term | Meaning |
|---|---|
| task | One row of the Ops table `tasks`. Any coherent unit of work. Its size does not matter. |
| task note | The Flint note of a task: `Mesh/Types/Tasks/(Task) <n> <title>.md` with the tag `#proj/task`. It holds the content. |
| note address | The id form of the address of a task note: `@v1/<org>/task/<note id>#flint/<flint>`, where `<note id>` is the UUID `id` of its frontmatter. |
| note label | The text that shows the note: `Task <n> · <Flint name>`. |
| open link | `obsidian://nuu-flint?address=` and the note address (URL-encoded). The NUU Flint plugin opens the note. |
| status | The Ops `checkbox`: `todo`, `doing`, or `done`. Every task has one. |
| outcome | Only for a done task: `completed`, `dropped`, or `superseded`. |
| task type | A versioned extension of the base task, for example `task.dev@0.1`. It adds fields and stages. An untyped task is the base type `task`. |
| stage | The second layer of a typed task. The task type defines the stages. |
| subtask | A Strike target mounted on an Ops task. Ops does not show subtasks. |
| task group | A set of tasks that are done together, usually in one session. Each task stays a full task. |
| lineage | The links `split-from`, `merged-into`, `continues-from`, and `after` (chain). |
| home | The one place of a task: a section (of a deliverable, a project, a deployment, or the org), or none. The backlog of a project is its section with the role `backlog`; the master backlog is the backlog section of the org. A subtask has the home of its root task. 0 or 1. The service word of a section is `subsection` (ops-command-1021). |
| related | A link from a task to a project, a deliverable, a repository, a Flint, or a v1 address. 0 or more. |
| unplaced | A task with no home. A normal state. |
| attachment | A link from a task or a task group to a session, a fleet, a note, or a repository. |
| task pin | The Orbh session keys `core:task` and `core:task-info`. |

Always write "task group", not "group" alone. Orbh has job groups (`--until-group`), and Invironments has `#ie/groups/`.

## The Two Parts of a Task

Each task that the Tasks shard makes has two parts, linked both ways (Task 1291):

- **The task note** holds the content. It lives in the Flint, in `Mesh/Types/Tasks/(Task) <n> <title>.md`, with the template `tmp-proj-task-v0.2` of the Projects shard and the number of the type `Task`. Its field `ops` holds the address of the Ops task.
- **The Ops task** holds the state: the status, the stage, the outcome, the type and its fields, the place, the lineage, the task groups, and the attachments. Its field `note` holds the note address, and `noteLabel` holds the note label. Its body stays empty: the note holds the content.

The rules:

- Ops owns the status, the stage, and the outcome. `task-sync` copies them, the type, and the date of the close into the note, in one direction only. A change goes to Ops first, then `task-sync` runs.
- `task-new` makes both parts and links them. `task-link` links a note and an Ops task that exist. `task-new --ops` gives a note to an Ops task that has none.
- A task that a person makes in the web, or that Strike makes, has no note. It keeps its body, and the rules of the body below apply to it.
- The Ops address stays the key of the task: the pin, the invocation input `task`, the attachments, and the commit trailer use it.
- Ops holds all views of tasks: the page `/<org>/tasks` with the tabs All, Unplaced, and Groups, and the task detail. The detail and each row show the note as "Open in Obsidian" (the open link).
- The note and the Ops task are two things with two ids (D8 of `ADDRESS.md`), and the fields `ops` and `note` link them (R27 of `ADDRESS.md`). The stored note address is the id form with the UUID; the chain form `@v1/<org>/flint/<flint>/task/<n>` is for typed input only.
- The Projects shard does not change. Its task notes have no Ops task.
- Another Mesh note can be a working document of a task. Attach it: `ops task attach <ref> note "<Mesh path>"`.

## The Task Note

The note is the Projects task note (`tmp-proj-task-v0.2`) with three more fields:

| Field | Value | Written by |
|---|---|---|
| `ops` | The Ops address, in double quotes: `"@v1/<org>/task.dev/<id>#ops"` | `task-new`, `task-link`; `task-sync` moves it when Ops gives a new address (a type change, an undo) |
| `task-type` | The type, for example `task.dev`; absent or empty for the base type | `task-new`; `task-sync` copies it |
| `stage` | The copy of the stage; empty when the task has no stage | `task-sync` |

`task-sync` also writes `status` and `completed`. The map of the status:

| Ops | The note `status` |
|---|---|
| `todo` | `todo` |
| `doing` | `in-progress` |
| `todo` or `doing`, with the flag `blocked` (Ops gives `{ reason, next?, at }`) | `blocked` |
| `done`, outcome `completed` (or none) | `done` |
| `done`, outcome `dropped` | `deprecated` |
| `done`, outcome `superseded` | `superseded` |

- The body has the sections of the template: `# Context`, `# Task Description`, `# Task Requirements`, `# Definition of Done`, `# Task Log`, and `# Notes`. The scope goes into the description and the requirements; each item of the definition of done is a checkbox that a reviewer can check.
- The steps of the work are subtasks in Strike, not lines of the note.
- The result of the work goes into the field `result` of Ops (`ops task result <ref> "<text>"`), and a line of the Task Log.
- A review writes its findings under `## Review Findings` in the note.
- The commits of a `task.dev` are in `wipCommits` of Ops. The field `wip-commits` of the note stays empty.
- The note keeps the frontmatter rules of the Flint: `orb` (the session stamps), `authors`, and `git-repos` (the repository of a `task.dev`).

## The Fields of a Task

These fields are new in v0.1. All of them are optional, so each older row stays valid.

| Field | Meaning |
|---|---|
| `type` | The task type, for example `task.dev`. Absent: the base type `task`. |
| `typeVersion` | The version of the type, for example `0.1`. Ops sets it at the create or at a type change, from the latest active version of the type or from a given version. |
| `stage` | The current stage. Absent: no stage yet. |
| `fields` | The type fields, by name. A value is a string or a list of strings. |
| `outcome` | `completed`, `dropped`, or `superseded`. Set when the status becomes `done`. |
| `unplaced` | `true`: the task has no project, deliverable, or section. |

The fields of before stay: `title`, `body`, `checkbox` (the status), `priority`, `ownerUserId`, `blocked`, `result`, and the placement fields `projectId`, `deliverableId`, `subsectionId` (the section), and `folderId` (a backlog folder of before the revamp of ops-command-1021). The revamp adds `parentTaskId` (a subtask), `tag`, and `recurrence`. Task 1291 adds `note` (the note address) and `noteLabel` (the note label), both optional.

## The Body of a Task With No Note

A task with a note has an empty body. A task with no note (from the web or from Strike) keeps its body in Markdown, with the context, the scope, and the definition of done. Use this structure:

```markdown
## Context

<Why the work is necessary. Links to the notes, the notepads, and the code.>

## Scope

<What the work changes, and what it does not change.>

## Definition of Done

- [ ] <One check that a reviewer can do>
- [ ] <…>

## Notes

<Research, decisions, and open questions. Optional.>
```

- The steps of the work are subtasks in Strike, not lines of the body.
- The result of the work goes into the field `result` (`ops task result <ref> "<text>"`), not into the body.
- A review writes its findings under `## Review Findings` in the body.
- To move the content into a note, give the task a note (`task-new --ops <ref>`), and move the text of the body into the note.

## Status and Outcome

```
todo → doing → done (outcome: completed | dropped | superseded)
          ↑       │
          └───────┘ reopen (clears the outcome)
```

- Every task has one status: `todo`, `doing`, or `done`. `blocked` is a flag, not a fourth status.
- A done task has one outcome. The default is `completed`. `dropped`: the work stops with no successor. `superseded`: another task takes the work (split, merge, or continue).
- A reopen sets `doing`, clears the outcome, and keeps the stage and the stage history.

## Task Types and Stages

A task type is an extension of the base task, with a version. It has five parts: the base type that it extends (`task`), its version, its extra fields, its stages, and the rules of each stage (`setBy` and `canClose`). The base type `task` has no stages: only the status.

- The type definitions are data in Ops (the table `task_types`). `ops task type list` and `ops task type show <type>` read them.
- Each task stores its type and its type version. When a new version of a type comes, an older task stays at its version.
- **Type change (rule C4.8).** `ops task retype` changes the type of a task that is not done (a done task refuses with `task_type_done`). The stage and the fields stay only when the new type defines them with the same name (and kind); `--none` clears the type, the stage, and the fields. The stage events stay. The address follows the type, and the old address still resolves. When a task needs a type after its create, retype it: do not make a new task.
- **A list field.** Remove one item with `ops task field <ref> <name> <value> --remove`, not with a `set` of the whole list: a set can lose an append of another session.
- The built-in type of v0.1 is `task.dev@0.1`. See [[dev-knw-task-dev]].

**The stage rules (C4).**

1. A stage write refuses a stage that the type does not define (`task_stage_unknown`), a write on an untyped task (`task_untyped`), and a write that `setBy` does not allow (`task_stage_forbidden`, for example an agent sets `verified`).
2. Any stage can follow any stage. The stages are an order for display, not a gate. Each stage write adds one stage event with the time and the actor.
3. A stage can change the status. For `task.dev`: `scoped` does not change the status; `built` and `reviewed` set `doing` when the status is `todo`; `verified` does not change the status.
4. Ops shows a done typed task as `done · <stage label>`, for example `done · Reviewed`.

**Who is an agent.** A write is by an agent when it has an Orbh session mark: the CLI `ops` sends `X-Agent-Session` from `ORBH_SESSION_ID`. Every other write is by a person (the web app, or `ops` in a terminal with no Orbh session). The mark is provenance, not security. So an agent never removes `ORBH_SESSION_ID` to set a stage of a person.

## The Close Rules

1. `ops task close <ref>` with the outcome `completed` on a typed task needs a current stage with `canClose: true`. Else it refuses with `task_stage_not_closable`.
2. The outcomes `dropped` and `superseded` are allowed at any stage.
3. An untyped task closes at any time.
4. `ops task done <ref>`, and an update to `done` from Strike or Trident, follow rule 1 with the outcome `completed`.
5. A reopen sets `doing`, clears the outcome, and keeps the stage.

## Lineage

A link never deletes history. Each link has a holder (the "from" task) and a target (the "to" task).

| Link | Holder | Target | Made by |
|---|---|---|---|
| `split-from` | Each new part | The old task | `ops task split` |
| `merged-into` | Each absorbed task | The survivor | `ops task merge` |
| `continues-from` | The continuation | The old task | `ops task continue` |
| `after` | The later task | The task before it | `ops task chain` |

- **Split.** Each part becomes a new task with the home, the type, the type version, and the relations of the old task, and no stage. The old task closes with `superseded`, unless `--keep-open`.
- **Merge.** With `--into <ref>`, that task is the survivor. Else a new task with `--title` and the home of the first task is the survivor. Each other task gets `merged-into`, and an open one closes with `superseded`.
- **Continue.** A new task with the home and the type of the old task gets `continues-from`. The default title is `<old title> (continued)`. An open old task closes with `superseded`. A done old task stays done.
- **Chain.** Each task after the first gets `after` the task before it. A task holds at most one `after` link: a new chain replaces it. A cycle refuses (`task_link_cycle`). A task in a chain is **ready** when the task before it is done.

## Task Groups

- A task group is a set of tasks that are done together, usually in one session. Each task in it stays a full task: its own home, its own status, its own stage, and its own result.
- A task can be in more than one task group (at most 20). A task group holds at most 50 tasks. The tasks of one task group can have different homes.
- A task group is open while one of its tasks is open. An empty task group is open. Ops computes this; nothing stores it.
- A task can leave a task group, for example when it needs its own session.
- A task group is not a fleet. A fleet is many sessions on one task. A task group is many tasks in one session.
- An attachment of a task group also shows on each of its tasks (marked with the task group). Ops does not copy the rows.

## Placement

| Part | Count | Values |
|---|---|---|
| home | 0 or 1 | A section: of a deliverable, of a project (its backlog has the role `backlog`), of a deployment (its inbox), or of the org (the master backlog) |
| related | 0 or more | `project`, `deliverable`, `repo`, `flint`, or `address` |

- A task with no home is **unplaced**. That is normal. An unplaced task is not in the org master backlog: the master backlog is a home. The tab Unplaced of Ops lists the unplaced tasks.
- A related link does not move the task. A project shows its related tasks in its "Related" list.
- A task has at most 100 relations.

**The hints.** `ops task hints` gives places for a task, sorted by score. There are three sources:

| Source | Flag | What it gives |
|---|---|---|
| The Flint | `--flint <Flint id>` | The deliverables whose `flintId` is this Flint |
| The text | `--text "<title>"` | The projects and the deliverables whose title shares words with the text |
| The repository | `--repo <name>` | The projects of the tasks that have a `repo` relation with that name |

A hint whose home is a section of a deliverable has `deliverableId`. Relate a deliverable by that id, never by its title.

**The placement rule.**

- One clear hint: set the home (`ops task home`).
- Two or more hints: add a `related` link to each (`ops task relate`), and leave the task unplaced.
- No hint: leave the task unplaced, with no project or deliverable link.
- A given place (from the person or the prompt) wins over the hints.
- A `task.dev` always gets a `repo` link with its field `repo`, also with a given place. The `repo` hints read these links. `ops task create --repo <name>` adds the link at the create.

The skill [[dev-sk-task-place_task]] applies the rule.

## Attachments

| Kind | `ref` | Example |
|---|---|---|
| `session` | The session address `@v1/<org>/session/<uuid>#flint/<slug>#<machine>`, with `--session-id <id>` | Made by `flint orbh task pin` |
| `fleet` | The fleet handle | `task-prim-1287` |
| `note` | A Mesh path or a v1 address | A notepad or a report of the work |
| `repo` | The repository name | `main` |

- An attachment links to a task or to a task group.
- An attach with the same target, kind, and ref as a live row updates its `label` and `state`. So a second attach is safe.
- A task or a task group has at most 100 live attachments.
- A detach sets `detachedAt`. The row stays as history.

## Subtasks

- A subtask is a part of a task. It lives only in Strike: a Strike target mounted on the Ops task. Ops does not show subtasks.
- The rule for new work: when the work serves the intent of the pinned task, make a subtask in Strike. When it does not, make a new task (or pin another task).

## Addresses

| Thing | Address |
|---|---|
| An untyped task | `@v1/<org>/task/<id>#ops` |
| A typed task | `@v1/<org>/task.dev/<id>#ops` |
| A task group | `@v1/<org>/taskgroup/<id>#ops` |
| A task note (in a Flint) | `@v1/<org>/task/<note id>#flint/<flint>` (the note address) |

- The type word `taskgroup` has no hyphen: a v1 type word is `^[a-z][a-z0-9]*$`.
- A resolve of `task/<id>` also finds a typed task.
- An undo of the delete of a task can give it a new id. Ops records the move (`task_moves`, old id to new id), and a resolve of the old address gives the task with its current address: `ops task show <old address> --json` shows the new canonical address. Use the new address from then on. `flint orbh task show` or `flint orbh task sync` updates a pin to it.
- Write the address in prompts, in pins, and in attachments. A Convex id alone is correct only inside one org.

## Error Codes

| Code | Meaning |
|---|---|
| `task_not_found` | No task has this ref in the org |
| `task_group_not_found` | No task group has this ref in the org |
| `task_untyped` | A stage write or a field write (`ops task stage`, `field` with `--append` or `--remove`, `commit`) on an untyped task |
| `task_note_invalid` | A note that is not a note address `@v1/<org>/task/<UUID>#flint/<key>` (the local form `@v1//…`, no place, another place than `flint`, two places, a key that is not a UUID, another type, more than 1024 characters), or a label of more than 120 characters, or a label with no note |
| `task_stage_unknown` | The type does not define the stage |
| `task_stage_forbidden` | `setBy` does not allow the actor (an agent sets `verified`) |
| `task_stage_not_closable` | A close with `completed` at a stage with `canClose: false`, or with no stage |
| `task_type_unknown` | No active task type has this name or version |
| `task_type_done` | A type change (`ops task retype`) on a done task: reopen it first |
| `task_field_unknown` | The type does not define the field |
| `task_field_invalid` | The value does not fit the field: a list for a text field, a text for a list field, a value over the length limits, an `--append` or a `--remove` on a text field, an empty item, or a set or an append of the same field in a write that removes from it |
| `task_stage_note_too_long` | The note of a stage write is too long |
| `task_link_cycle` | A chain makes a cycle |
| `task_lineage_invalid` | A split, merge, continue, or chain that breaks a rule (for example an empty or too long title) |
| `task_group_invalid` | A task group write that breaks a rule, for example more than 50 tasks, or a task in more than 20 task groups |
| `task_relation_invalid` | A relation that breaks a rule, for example a bad kind or ref, or more than 100 relations |
| `task_attachment_invalid` | An attachment that breaks a rule, for example both or neither of a task and a task group, or more than 100 live attachments |
| `task_unplaced_with_home` | A write gives a home and `unplaced` together |
