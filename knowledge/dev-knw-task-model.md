---
description: "The task model of NUU Ops and the Tasks shard: the two parts of a task (the task note and the Ops task), the terms, the fields, the status and the result, the close rules, the review requests, the people looped in, an agent session at a task (its duty, the comments and the chat, the agent defaults), lineage, task groups, placement, attachments, and addresses"
---

# Knowledge: The Task Model

This file is the model of the task primitive v0.1 (Notepad 237, Task 1287, sections C0 to C5 of its contract), with the task notes of Task 1291 (contract N). Read it before you create, change, or close a task. The commands are in [[dev-knw-task-cli]]. The WIP commit rule is in [[dev-knw-task-commits]].

## Terms

| Term | Meaning |
|---|---|
| task | One row of the Ops table `tasks`. Any coherent unit of work. Its size does not matter. |
| task note | The Flint note of a task: `Mesh/Types/Tasks/(Task) <n> <title>.md` with the tag `#proj/task`. It holds the content. |
| note address | The id form of the address of a task note: `@v1/<org>/task/<note id>#flint/<flint>`, where `<note id>` is the UUID `id` of its frontmatter. |
| note label | The text that shows the note: `Task <n> · <Flint name>`. |
| open link | `obsidian://nuu-flint?address=` and the note address (URL-encoded). The NUU Flint plugin opens the note. |
| status | The Ops `checkbox`: `todo`, `doing`, or `done`. Every task has one. |
| result | The text of what the work gave. It names the commits and the session of the work. |
| looped in | The people who follow a task beside its owner. Each one hears every comment on the task. |
| subtask | In the work of this shard: a step of the work, a Strike target mounted on an Ops task. Ops also has subtasks of its own (an Ops task with a parent task, one level only: a subtask has no subtasks, and a deeper placement is refused with `subtask_too_deep`). Ops shows them: `ops task subtask list\|children <task>`. |
| task group | A set of tasks that are done together, usually in one session. Each task stays a full task. |
| lineage | The links `split-from`, `merged-into`, `continues-from`, and `after` (chain). |
| home | The one place of a task: a section (of a deliverable, a project, a deployment, or the org), or none. The backlog of a project is its section with the role `backlog`; the master backlog is the backlog section of the org. A subtask has the home of its root task. 0 or 1. The service word of a section is `subsection` (ops-command-1021). |
| related | A link from a task to a project, a deliverable, a repository, a Flint, or a v1 address. 0 or more. |
| unplaced | A task with no home. A normal state. |
| attachment | A link from a task or a task group to a session, a fleet, a note, or a repository. |
| task object | An Ops task in the context of an Orbh session: an item of the Objects Protocol (`flint orbh objects add <address> --subscribe`). The Page shows it in the `OBJECTS` block. |
| agent session | An Orbh session that works on a task for a person. It keeps the task as a task object. |
| comment | A text in the updates of a task. Only a task carries comments. |
| the chat | Orbh Chat: the one conversation of an agent session with the people who can run the session. |
| agent defaults | The Flint, the computer, the site, the profile, and the mode that a new agent session at the task gets. |

Always write "task group", not "group" alone. Orbh has job groups (`--until-group`), and Invironments has `#ie/groups/`.

## The Two Parts of a Task

Each task that the Tasks shard makes has two parts, linked both ways (Task 1291):

- **The task note** holds the content. It lives in the Flint, in `Mesh/Types/Tasks/(Task) <n> <title>.md`, with the template `tmp-proj-task-v0.2` of the Projects shard and the number of the type `Task`. Its field `ops` holds the address of the Ops task.
- **The Ops task** holds the state: the status, the result, the place, the lineage, the task groups, and the attachments. Its field `note` holds the note address, and `noteLabel` holds the note label. Its body stays empty: the note holds the content.

The rules:

- Ops owns the status and the result. `task-sync` copies the status and the date of the close into the note, in one direction only. A change goes to Ops first, then `task-sync` runs.
- `task-new` makes both parts and links them. `task-link` links a note and an Ops task that exist. `task-new --ops` gives a note to an Ops task that has none.
- A task that a person makes in the web, or that Strike makes, has no note. It keeps its body, and the rules of the body below apply to it.
- The Ops address stays the key of the task: the task object of a session, the invocation input `task`, and the attachments use it.
- Ops holds all views of tasks: the page `/<org>/tasks` with the tabs All, Unplaced, and Groups, and the task detail. The detail and each row show the note as "Open in Obsidian" (the open link).
- The note and the Ops task are two things with two ids (D8 of `ADDRESS.md`), and the fields `ops` and `note` link them (R27 of `ADDRESS.md`). The stored note address is the id form with the UUID; the chain form `@v1/<org>/flint/<flint>/task/<n>` is for typed input only.
- The Projects shard does not change. Its task notes have no Ops task.
- Another Mesh note can be a working document of a task. Attach it: `ops task attach <ref> note "<Mesh path>"`.

## The Task Note

The note is the Projects task note (`tmp-proj-task-v0.2`) with one more field:

| Field | Value | Written by |
|---|---|---|
| `ops` | The Ops address, in double quotes: `"@v1/<org>/task/<id>#ops"` | `task-new`, `task-link`; `task-sync` moves it when Ops gives a new address (an undo, or an old address `task.dev/<id>`) |

An old note can have the fields `task-type` and `stage` of the task types of before. `task-sync` clears them: the lines stay with no value. Do not write them.

`task-sync` also writes `status` and `completed`. The map of the status:

| Ops | The note `status` |
|---|---|
| `todo` | `todo` |
| `doing` | `in-progress` |
| `todo` or `doing`, with the flag `blocked` (Ops gives `{ reason, next?, at }`) | `blocked` |
| `done` | `done` |

A task has no outcome, so `task-sync` writes no `deprecated` and no `superseded`. A note of before with one of them becomes `done` at its next `task-sync`.

- The body has the sections of the template: `# Context`, `# Task Description`, `# Task Requirements`, `# Definition of Done`, `# Task Log`, and `# Notes`. The scope goes into the description and the requirements; each item of the definition of done is a checkbox that a reviewer can check.
- The steps of the work are subtasks in Strike, not lines of the note.
- The result of the work goes into the field `result` of Ops (`ops task result <ref> "<text>"`), and a line of the Task Log. The result names the commits and the session of the work: `<summary>. Commits: <sha> (<repo>), …. Session: <ORBH_SESSION_ID>` ([[dev-knw-task-commits]]).
- A review writes a pass into the result, and its findings under `## Review Findings` in the note.
- The field `wip-commits` of the note stays empty: the result names the commits.
- The note keeps the frontmatter rules of the Flint: `orb` (the session stamps), `authors`, and `git-repos` (the repository of the work, from `task-new --repo`).

## The Fields of a Task

These fields are new in v0.1. All of them are optional, so each older row stays valid.

| Field | Meaning |
|---|---|
| `unplaced` | `true`: the task has no project, deliverable, or section. |

A task has no outcome. Before 2026-11-04 a done task had the field `outcome` (`completed`, `dropped`, or `superseded`). Ops removed it (operator page feedback): a done task is done. `tasks.close` still takes `outcome` and ignores it, so an older `ops` still closes a task.

Ops has no task types. A task has no `type`, `typeVersion`, `stage`, or `fields`, and `ops task show --json` does not give them. Progress goes into the status and the result.

The fields of before stay: `title`, `body`, `checkbox` (the status), `priority`, `ownerUserId`, `blocked`, `result`, and the placement fields `projectId`, `deliverableId`, `subsectionId` (the section), and `folderId` (a backlog folder of before the revamp of ops-command-1021). The revamp adds `parentTaskId` (a subtask), `tag`, and `recurrence`. Task 1291 adds `note` (the note address) and `noteLabel` (the note label), both optional. Ops Task 402 adds `loopedIn` (the users IDs of the people looped in, § Looped In).

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

## Status and Result

```
todo → doing → done
          ↑       │
          └───────┘ reopen (keeps the result)
```

- Every task has one status: `todo`, `doing`, or `done`. `blocked` is a flag, not a fourth status.
- A done task is done. It has no outcome. The result says what the work gave. When the work stops with no successor, the result says so. When another task takes the work, the lineage link says so (split, merge, or continue).
- A reopen sets `doing` and keeps the result.
- **Who is an agent.** A write is by an agent when it has an Orbh session mark: the CLI `ops` sends `X-Agent-Session` from `ORBH_SESSION_ID`. Every other write is by a person (the web app, or `ops` in a terminal with no Orbh session). The mark is provenance, not security. So an agent never removes `ORBH_SESSION_ID` to write as a person.

### From a Flint Task File

The statuses of the Projects shard map to the status of an Ops task. Use the map when you move the work of a Flint task file to an Ops task.

| Task file status | Status | Also |
|---|---|---|
| `todo` | `todo` | — |
| `in-progress` | `doing` | — |
| `review`, `reviewing`, `reviewed` | `doing` | — |
| `done` | `done` | — |
| `blocked`, `deferred` | The status before, with the flag `blocked` | — |
| `deprecated` | `done` | The result says that the work stopped, and why |
| `superseded` | `done` | A lineage link from the task that takes the work (`ops task link <new task> <old task>`), and a result that names it |

Ops has no field for a review. For `review`, `reviewing`, and `reviewed`, write the state of the review in the result.

## The Close Rules

1. `ops task close <ref> [--result "<text>"]` closes the task at any time. A task has no outcome: do not pass `--outcome` (the CLI refuses it).
2. `ops task done <ref>`, and an update to `done` from Strike or Trident, close the task too.
3. A reopen sets `doing` and keeps the result.

## Review Requests

A review request asks one person to review a task (Ops Task 402). It is an item of the review queue of that person: the page **Your Reviews** of the web app lists the open requests of every org, oldest first.

1. With no reviewer, the reviewer is the owner of the task. A task with no owner takes the caller in a personal org, and refuses with `review_no_reviewer` in a team org.
2. One open request for each task and reviewer. A second request changes its note.
3. The reviewer approves (this closes the task, unless keep open), asks for changes (the task stays open, and a done task opens again), or dismisses. The requester can cancel.
4. A close or a delete of the task cancels its open requests. An undo brings them back.
5. The agent of a person writes as that person, so a request of an agent to its own person is a request to oneself. That person still gets the notification, from the agent.
6. The rows of the web app show **In review** while a request is open.
7. A request loops the reviewer into the task (§ Looped In), unless the reviewer is the owner. The reviewer then hears every comment on the task.
8. **Your Reviews** also lists the open requests that you asked of other people ("You asked for"). `ops review list` shows them in the section `you asked for`.

## Looped In

The people looped into a task follow it beside its owner (Ops Task 402, amendment 1). Each one hears every comment on the task. A task loops in at most 50 people (`loop_full`).

- A review request loops in the reviewer, unless the reviewer is the owner.
- A mention of a member in a comment loops in that member.
- A person loops in a member with the field "Looped in" of the task dialog, or with `ops task loop add <ref> <person>`. The person gets a notification. `ops task loop remove <ref> <person>` takes a person out.
- `ops task show` names the people looped in.

## An Agent Session at a Task

A session is **at** a task when it keeps the task as an item (`flint orbh objects add <address> --subscribe`). A person starts an agent session at a task in Ops, or attaches a session that runs. The **current object** of a session is its newest Ops item (`addedAt`). A session can be at more than one object. The page Agents of Ops and `ops agents` list the sessions at Ops objects now. A person sees a session, its timeline, and its chat only with `view` on its computer.

**The duty.** The session works on the task for the person who attached it:

1. It keeps the task in its objects.
2. It answers a person first, in the place where the person wrote.
3. When `orbh:objects` says that the task changed, it reads the new updates.
4. When a review asks for changes, it does them, writes the result again, and requests the review again.
5. It posts progress as short comments.

**Two equal ways to speak.** A person speaks to the agent session with a comment on the task or with a message in the chat. Both are valid. A person message has priority over the other work: the session answers it before it continues.

| Way | Where it is | The session reads | The session answers |
|---|---|---|---|
| Comment | The updates of the task, in Ops | `ops comment list <task>`, after a message of `orbh:objects` | `ops comment add <task> "<text>"` |
| The chat | The chat of the session (Orbh Chat): one conversation for each session, between the people who can `run` it and the session | The block `CHAT` of the Page (the unread chat, first), or `flint orbh chat read` | `flint orbh chat send "<text>"` |

- A change of the task reaches the session as an event (a push), not as a timed check. The session gets no message for its own write.
- A comment notifies the owner, the creator, and the people looped in. A chat message reaches the people who can run the session.
- The chat has the verbs `flint orbh chat send "<text>"`, `flint orbh chat read`, and `flint orbh chat on|off`.

**The agent defaults.** The launcher of an agent session derives its defaults. The order: the object (the task), then its section, its deliverable, its project, and its org, then the last choice of the person. A project and a deliverable hold the agent defaults: the Flint (their Flint place), the computer, the site, the profile (`runtime/profile`), and the mode (`headless`, `interactive`, or `obsidian`). Each field comes from the nearest level that has one: the Flint task note of the task, then the deliverable, then the project. `ops agents defaults <task>` shows each value with its source. `ops agents defaults set <project or deliverable> …` sets them.

## Lineage

A link never deletes history. Each link has a holder (the "from" task) and a target (the "to" task).

| Link | Holder | Target | Made by |
|---|---|---|---|
| `split-from` | Each new part | The old task | `ops task split` |
| `merged-into` | Each absorbed task | The survivor | `ops task merge` |
| `continues-from` | The continuation | The old task | `ops task continue` |
| `after` | The later task | The task before it | `ops task chain` |

- **Split.** Each part becomes a new task with the home and the relations of the old task. An open old task closes, unless `--keep-open`.
- **Merge.** With `--into <ref>`, that task is the survivor. Else a new task with `--title` and the home of the first task is the survivor. Each other task gets `merged-into`, and an open one closes.
- **Continue.** A new task with the home of the old task gets `continues-from`. The default title is `<old title> (continued)`. An open old task closes. A done old task stays done.
- **Chain.** Each task after the first gets `after` the task before it. A task holds at most one `after` link: a new chain replaces it. A cycle refuses (`task_link_cycle`). A task in a chain is **ready** when the task before it is done.

## Task Groups

- A task group is a set of tasks that are done together, usually in one session. Each task in it stays a full task: its own home, its own status, and its own result.
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
- A task whose work changes code in a repository gets a `repo` link, also with a given place. The `repo` hints read these links. `ops task create --repo <name>` (and `task-new --repo <name>`) adds the link at the create.

The skill [[dev-sk-task-place_task]] applies the rule.

## Attachments

| Kind | `ref` | Example |
|---|---|---|
| `session` | The session address `@v1/<org>/session/<uuid>#flint/<slug>#<machine>`, with `--session-id <id>` | A session of the work |
| `fleet` | The fleet handle | `task-prim-1287` |
| `note` | A Mesh path or a v1 address | A notepad or a report of the work |
| `repo` | The repository name | `main` |

- An attachment links to a task or to a task group.
- An attach with the same target, kind, and ref as a live row updates its `label` and `state`. So a second attach is safe.
- A task or a task group has at most 100 live attachments.
- A detach sets `detachedAt`. The row stays as history.

## Subtasks

- **A step of the work is a subtask in Strike**: a Strike target mounted on the Ops task. The workflows of this shard make these.
- **Ops has subtasks too**: an Ops task with a parent task (`ops task create --parent <task>`, `ops task subtask add <parent> <title>`). Ops has one level: a subtask has no subtasks, and a task with subtasks cannot become a subtask (`subtask_too_deep`, Ops Task 409). Ops shows them (`ops task subtask list <task>`, `ops task subtask children <task>`), and a subtask has the home of its parent. Make an Ops subtask only when the person asks for one.
- The rule for new work: when the work serves the intent of a task object of the session, make a subtask in Strike. When it does not, make a new task (or add another task as an object).

## Addresses

| Thing | Address |
|---|---|
| A task | `@v1/<org>/task/<id>#ops` |
| A task group | `@v1/<org>/taskgroup/<id>#ops` |
| A task note (in a Flint) | `@v1/<org>/task/<note id>#flint/<flint>` (the note address) |

- The type word `taskgroup` has no hyphen: a v1 type word is `^[a-z][a-z0-9]*$`.
- An old address `@v1/<org>/task.dev/<id>#ops` (of a task that had the type `task.dev`) still resolves to the same task, but Ops makes no such address again. `ops task show <old address> --json` gives the address `task/<id>`: use it from then on.
- An undo of the delete of a task can give it a new id. Ops records the move (`task_moves`, old id to new id), and a resolve of the old address gives the task with its current address: `ops task show <old address> --json` shows the new canonical address. Use the new address from then on. When the task is an object of the session, add the new address as an object, and remove the item of the old address.
- Write the address in prompts, in object verbs, and in attachments. A Convex id alone is correct only inside one org.

## Error Codes

| Code | Meaning |
|---|---|
| `task_not_found` | No task has this ref in the org |
| `task_group_not_found` | No task group has this ref in the org |
| `task_note_invalid` | A note that is not a note address `@v1/<org>/task/<UUID>#flint/<key>` (the local form `@v1//…`, no place, another place than `flint`, two places, a key that is not a UUID, another type, more than 1024 characters), or a label of more than 120 characters, or a label with no note |
| `task_link_cycle` | A chain makes a cycle |
| `task_lineage_invalid` | A split, merge, continue, or chain that breaks a rule (for example an empty or too long title) |
| `task_group_invalid` | A task group write that breaks a rule, for example more than 50 tasks, or a task in more than 20 task groups |
| `task_relation_invalid` | A relation that breaks a rule, for example a bad kind or ref, or more than 100 relations |
| `task_attachment_invalid` | An attachment that breaks a rule, for example both or neither of a task and a task group, or more than 100 live attachments |
| `task_unplaced_with_home` | A write gives a home and `unplaced` together |
| `review_no_reviewer` | A review request of a task of a team with no owner: give `--to <member>`, or `--to me` (the operator) |
| `review_task_done` | A review request of a done task: reopen it first |
| `review_not_reviewer` | A verdict by a person who is not the reviewer |
| `review_not_requester` | A cancel by a person who did not ask for the review |
| `review_not_open` | A verdict or a cancel of a request that is closed already |
| `review_ambiguous` | A cancel that matches two of your requests (the CLI): give `--to <member>` |
| `loop_full` | A task that loops in 50 people already: take a person out first (`ops task loop remove <ref> <person>`) |
