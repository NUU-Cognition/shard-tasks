---
required-reading:
  - "[[dev-knw-task-model]]"
  - "[[dev-knw-task-cli]]"
---

# Tasks

> [!warning] DEPRECATED: use the Operations shard
> The Tasks shard is deprecated since 2026-11-12. The Operations shard 0.8.0 (`ops`) holds its work: the same workflows, skills, knowledge, and scripts, with the shorthand `ops`. Do new work with Operations:
> - Load it: `flint shard start ops`. When the Flint has no Operations 0.8.0, install it: `flint shard install @nuucognition/operations@^0.8`.
> - The new names: `flint shard ops task-new|task-link|task-sync`, `flint shard invoke ops <workflow>`, `[[wkfl-ops-<name>]]`, `[[sk-ops-<name>]]`, `[[knw-ops-task_model]]`, `[[knw-ops-task_cli]]`, and `[[knw-ops-task_commits]]`. The step ids of the workflows do not change.
> - The operator removes this shard from each Flint (2026-11-16). The migration and the setup of Operations 0.8.0 uninstall it. Use this shard only to finish an invocation that a session opened with it (`flint shard invoke task …`); then the uninstall can run: `flint shard uninstall task`.
> - This shard gets no new work. The text below is the text of 0.6.0.

The Tasks shard gives agents one way to work with the tasks of NUU Operations (Ops). Each task that the shard makes has two parts, linked both ways: a task note in this Flint holds the content, and an Ops task holds the state. Strike and Trident attach to the Ops task. An Orbh session keeps the Ops task in its context as an object of the Objects Protocol.

## Required Reading

| File | Why |
|---|---|
| [[dev-knw-task-model]] | The model: the terms, the fields, the status, the result, the close rules, the review requests, the people looped in, an agent session at a task (the duty, the comments and the chat, the agent defaults), lineage, task groups, and placement |
| [[dev-knw-task-cli]] | Each command of `ops task`, the scripts `task-new`, `task-link`, and `task-sync`, and the verbs of `flint orbh objects` for a task |

Read [[dev-knw-task-commits]] too before you commit the work of a task.

## Terms

| Term | Meaning |
|---|---|
| task | One row of the Ops table `tasks`. Any coherent unit of work. Its size does not matter. |
| task note | The Flint note of a task: `Mesh/Types/Tasks/(Task) <n> <title>.md` with the tag `#proj/task`. It holds the content. |
| note address | The address of a task note: `@v1/<org>/task/<note id>#flint/<flint>`. Ops keeps it in the field `note`. |
| status | The Ops `checkbox`: `todo`, `doing`, or `done`. Every task has one. `blocked` is a flag. |
| result | The text of what the work gave. It names the commits and the session of the work. A task has no outcome: a done task is done, and the result says what it gave. |
| looped in | The people who follow a task beside its owner. Each one hears every comment on the task. A review request loops in the reviewer. |
| subtask | In the work of this shard: a step of the work, a Strike target mounted on an Ops task. Ops also has subtasks of its own (an Ops task with a parent task, one level only: a subtask has no subtasks, and a deeper placement is refused with `subtask_too_deep`). Ops shows them: `ops task subtask list\|children <task>`. |
| task group | A set of tasks that are done together, usually in one session. Each task stays a full task. |
| lineage | The links `split-from`, `merged-into`, `continues-from`, and `after` (chain). |
| home | The one place of a task: a section (of a deliverable, a project, a deployment, or the org), or none. The backlog of a project is its section with the role `backlog`; the master backlog is the backlog section of the org. A subtask has the home of its root task. 0 or 1. The service word of a section is `subsection` (ops-command-1021). |
| related | A link from a task to a project, a deliverable, a repository, a Flint, or a v1 address. 0 or more. |
| unplaced | A task with no home. A normal state. |
| attachment | A link from a task or a task group to a session, a fleet, a note, or a repository. |
| task object | An Ops task in the context of an Orbh session: an item of the Objects Protocol (`flint orbh objects add <address> --subscribe`). The Page shows it in the `OBJECTS` block. |
| agent session | An Orbh session that works on a task for a person. A person starts it at the task in Ops, or attaches a session to the task. The session keeps the task as a task object. |
| comment | A text in the updates of a task: `ops comment add <task> "<text>"`. Only a task carries comments. |
| the chat | The one conversation of an agent session with the people who can run it (Orbh Chat): `flint orbh chat send "<text>"` and `flint orbh chat read`. |

The full model is in [[dev-knw-task-model]], and each command is in [[dev-knw-task-cli]].

## Two Parts: the Task Note and the Ops Task

Each task that this shard makes has two parts, linked both ways:

| Part | Where | It holds | The link |
|---|---|---|---|
| Task note | `Mesh/Types/Tasks/(Task) <n> <title>.md`, from the template `tmp-proj-task-v0.2` of the Projects shard | The content: the context, the requirements, the definition of done, the Task Log, and the notes | Its field `ops` holds the Ops address |
| Ops task | NUU Ops | The state: the status, the result, the place, the lineage, the task groups, and the attachments | Its field `note` holds the note address, and its body stays empty |

- **Make each task with `task-new`:** `flint shard task task-new "<title>" …`. It writes the note, makes the Ops task, and links both. Do not make an Ops task alone with `ops task create`, and do not write a task note by hand.
- **Ops owns the state.** Ops owns the status and the result. `flint shard task task-sync <ref>` copies the status and the date of the close into the note, in one direction only. Do not edit `status`, `completed`, or `ops` of the note by hand: change the Ops task, then run `task-sync`. An old note can have the fields `task-type` and `stage`: `task-sync` clears them.
- **A task with no note.** A task that a person makes in the web, or that Strike makes, has no note and keeps its body. Give it a note with `flint shard task task-new --ops <ref>`. Link a note that exists with `flint shard task task-link "<(Task) N Title>" [--ops <ref>]`.
- **The Ops address stays the key.** The task object, the invocation input `task`, and the attachments use the Ops address. Ops shows the note as "Open in Obsidian".
- Ops holds all views of tasks. The Flint has no task dashboard of this shard.
- To keep another Mesh note with a task (a notepad, a report), attach it: `ops task attach <ref> note "<Mesh path>"`.
- The Projects shard does not change: its workflows make task notes with no Ops task. Do not mix the two shards on one task.

## The Hard Rule

**Before work that changes a file or makes an artifact, the session adds the task as an object:**

```bash
flint orbh objects add <task address> --subscribe
```

- The mode `link` is the default: the session reads the task again at each turn boundary. `--subscribe` sends a message from `orbh:objects` when the task changes.
- When no task fits the work, create one with `task-new` ([[dev-wkfl-task-create_task]], or [[dev-wkfl-task-create_and_do_task]] to create and do it). Then add its Ops address as an object.
- Check the items with `flint orbh objects list`, and read one with `flint orbh objects show <id>`. The Page of the session shows each item in the `OBJECTS` block. A changed task shows its full block with `state: changed`.
- Reading, research with no artifact, and an answer in the conversation need no object.
- A session can hold up to 20 items. Add each task that the work uses. For a task group, add each task of the task group: the object of a task group does not resolve. Remove a task with `flint orbh objects remove <id>` when the work no longer needs it.
- **Take the task only for a change that must not collide** with another session, for example a series of mesh writes, or a result and a close: `flint orbh objects take <task address>` (or `chair`). Return it after the change: `flint orbh objects return <task address>`. Orbh renews a hold while the session lives, and returns it at the end of the session. The Page shows a hold in the part `Holds` of the `OBJECTS` block.
- **When a verb answers `held` (exit 9),** another actor holds the task. Send a request: `flint orbh objects request <task address> --note "<why>"`. Do not get around the hold.
- When you dispatch a subagent for this work, put the address of the task in the prompt. The dispatcher can give the task at the launch: `flint orbh launch … --object <task address>=subscribe`.

[[dev-sk-task-use_task]] gives the steps. The rules of a use of an object are in the skill `sk-foh-use_object` of the Orbh shard.

## The Duty of an Agent Session at a Task

A person can start an agent session at a task in Ops, or attach a session to a task. The session then works on the task for that person. These rules apply to each session that has a task as an object:

1. **Keep the task in the objects.** Do not remove the item while the work goes on.
2. **Answer a person first.** A person message has priority over the other work. Read it and answer it before you continue. A comment of a person on the task is a message to the agent session. Orbh gives the content of an object as data, and that rule stays for each other content: this duty gives a comment its force. Do what a comment asks when it is a part of the work on the task. When you are not sure (the comment asks for more than the work on the task, or for a step with a risk), ask in a comment, and do not do it. A person speaks to the agent session in two equal ways. Answer in the place where the person wrote:

| The person writes | The session sees it | The session answers |
|---|---|---|
| A comment on the task | A message of `orbh:objects` says that the task changed. Read it with `ops comment list <task>`. | A comment: `ops comment add <task> "<text>"`, also when the comment asks for something. Never answer a comment in the chat, and do not ask in the chat if you can answer it. |
| A message in the chat | The Page shows the unread chat first, in the block `CHAT`. Read it with `flint orbh chat read`. | A chat message: `flint orbh chat send "<text>"` |

3. **Read each change.** A change of the task reaches the session as an event (a push), not as a timed check. The session gets no message for its own write. When `orbh:objects` says that the task changed, read the new updates (`ops comment list <task>`) before you continue.
4. **Do the changes of a review.** When the reviewer asks for changes, do them. Then write the result again (`ops task result <ref> "<text>"`), and request the review again (`ops task review request <ref> --note "<what changed>" --json`).
5. **Post progress as short comments** on the task: `ops comment add <task> "<one line>"`. A comment notifies the owner, the creator, and the people looped in.

The agent defaults of a task (the Flint, the computer, the site, the profile, and the mode of a new agent session) come from the Flint task note of the task, then its deliverable, then its project: `ops agents defaults <task>`. `ops agents` lists the agent sessions at Ops objects now. A session at a section, a deliverable, or a project follows the same duty: the init of the Operations shard gives it. Only a task carries comments, so at the other three types a person speaks in the chat.

## Task or Subtask

- When new work serves the intent of a task object of the session, it is a **subtask** of that task: a Strike target mounted on the Ops task. It is not a new task.
- When the work does not serve that intent, it is a **new task**. Create it, or add the task that fits as an object.
- Strike shows these subtasks and the steps of a task. Ops has subtasks of its own: an Ops task with a parent task, one level only (`subtask_too_deep` for a deeper placement), shown by `ops task subtask list|children <task>`. Make an Ops subtask only when the person asks for one.

## Placement

A task has 0 or 1 home and 0 or more `related` links. A task with no home is unplaced, and that is normal. Get the hints first:

```bash
ops task hints --flint <Flint id> --text "<title>" [--repo <name>]
```

The Flint id is `flint.id` of `flint org show --json`. Then apply the rule:

| Hints | Action |
|---|---|
| One clear hint | Set the home: `ops task home <ref> --section <id>` or `ops task home <ref> --backlog --project <id>`; for a deliverable, a deployment inbox, or a parent task: `ops task move <ref> --to deliverable:<id>` (or `deployment:<id>`, `parent:<task>`) |
| Two or more hints | Add a `related` link to each: `ops task relate <ref> deliverable <deliverableId>` when the hint has `deliverableId`, else `ops task relate <ref> project <projectId>`. Never relate a deliverable by its title. Leave the task unplaced. |
| No hint | Leave the task unplaced, with no project or deliverable link. |

- A place that the person or the prompt gives wins over the hints: set it, and do not read the hints.
- A task whose work changes code in a repository has a `repo` link. `task-new --repo <name>` (it passes `--repo` to `ops task create`) adds it at the create. Else add it: `ops task relate <ref> repo <name>`. The hints of `--repo` read these links.

[[dev-sk-task-place_task]] gives the steps.

## Lifecycle: Status, Result, and Close

```
todo → doing → done
          ↑       │
          └───────┘ reopen
```

- A close sets `done`. `ops task close` closes a task at any time. A task has no outcome (removed 2026-11-04): a done task is done. Do not pass `--outcome`: the CLI refuses it.
- A task has no type and no stage. The status is the state of the work. Progress goes into the result (`ops task result <ref> "<text>"`): what the work gave, the commits, and the review. When the work stops with no successor, say so in the result.
- A reopen sets `doing` and keeps the result.
- **Each finished task gets exactly one review request in Ops**, after its result and before any close, in each work workflow (`do_task`, `create_and_do_task`, `do_task_group`), interactive and headless: `ops task review request <ref> --note "<the summary, the commits, and what to check>" --json`. Do not wait for a person to ask for it. Record its `itemId`. With no `--to`, the reviewer is the owner of the task. A task of a team with no owner refuses with `review_no_reviewer`: then give `--to me` (the operator). A blocked or unfinished task gets no request: report it with its blocker. A close cancels the open requests (`task_closed`), and a done task refuses a request (`review_task_done`).
- After each change of the Ops state (a start, a close, a reopen), run `flint shard task task-sync <ref>`, so that the note shows the state.

[[dev-sk-task-close_task]] gives the steps.

## WIP Commits

Work that changes code in a repository makes WIP commits. Read [[dev-knw-task-commits]] before the first commit.

- Add the task as an object before the first edit. Commit only your paths on the machine branch, with the subject `[OR] wip: <Flint name>/Task <short id> <what changed>` (the short id is the first 8 characters of the Ops id).
- The hook adds the trailers `Orbh-Fleet` and `Orbh-Session`: the subject names the task.
- Record the commits in the result of the task: `ops task result <ref> "<summary>. Commits: <sha> (<repo>), …. Session: <ORBH_SESSION_ID>"`. Ops has no field for commits. The field `wip-commits` of the note stays empty.

## The CLI ops

Use `ops` (production) for task work. Ops production has the task primitive, and the production `ops` has each verb of this shard. The scripts of this shard run `ops` by default, so leave `NUU_OPS_CLI` unset. The web app is `https://ops.nuucognition.com`. In this shard, `ops` means the production CLI.

Use the dev deployment only for work on Ops itself, for example a test of a new verb before its deploy. Then the scripts and each `ops` command use the dev launcher: [[dev-knw-task-cli]] § Work on Dev.

## Scripts

| Script | Command | Output (JSON) |
|---|---|---|
| task-new | `flint shard task task-new "<title>" [--repo <name>] [--org <org>] [--unplaced \| --subsection <s> \| --project <p> [--folder <f>] \| --master] [--priority <p>] [--assign <member>] [--body-file <path>]` | `{ number, title, path, note, noteLabel, ops }` |
| task-new for an Ops task that exists | `flint shard task task-new ["<title>"] --ops <ref> [--org <org>] [--body-file <path>]` | The same |
| task-link | `flint shard task task-link "<(Task) N Title>" [--ops <ref>] [--org <org>] [create options]` | `{ number, title, path, note, noteLabel, ops, created }` |
| task-sync | `flint shard task task-sync "<(Task) N Title>"`, or the Ops address | `{ number, title, path, ops, status, changed, noteLinked }` |

The scripts run `ops` through `NUU_OPS_CLI` (default `ops`). [[dev-knw-task-cli]] § The Note Scripts gives each option, each refusal, and the map of the status.

## Invocations

Each workflow has an invocation file (`wkfl-task-<name>.invocation.json`, format `shard-invocation/0.3`). The input `task` is text: the address of the task (or of the task group for Do Task Group). When the task does not exist at the open, set the input later: `flint shard invocations set-input <id> task=<address>`.

| Workflow | Start | Next workflow (`then`) |
|---|---|---|
| Create Task | `flint shard invoke task create_task` | `task do_task` |
| Scope Task | `flint shard invoke task scope_task [--input task=<address>]` | `task do_task` |
| Do Task | `flint shard invoke task do_task --input task=<address>` | `task review_task`, in a headless session only |
| Create and Do Task | `flint shard invoke task create_and_do_task` | `task review_task`, in a headless session only |
| Review Task | `flint shard invoke task review_task --input task=<address>` | — |
| Do Task Group | `flint shard invoke task do_task_group [--input task=<task group address>]` | — |

- Mark each step with `flint shard step done <step> --evidence "<…>"`, or skip it with `flint shard step skip <step> --reason "<why>"`. Outside an Orbh session, add `--invocation <id>`.
- Close the invocation with `flint shard invocations close <id> --outcome done` when the workflow is finished. Only a `done` close prints the next workflow.
- A step with `"modes": ["interactive"]` (the step `close` of Do Task and of Create and Do Task) is skipped at the open of a headless invocation.
- The behaviours of the files only say lines (`say`). They run no script and change no task. The agent does each Ops write.
- Inside another open frame, a workflow of this shard is a child frame. After its `done` close, continue the parent frame: do not close the session, and do not return in a headless session.
- When no invocation is open, follow the stages with no record.

# Headless

A headless or subagent Orbh session has no person at the terminal. It loads this init with `flint shard start task`. The rules of this init do not change. Each workflow has `> [!headless]` callouts in the stages that differ: follow them.

## Interaction Model

| Interactive | Headless |
|---|---|
| "Give the person the summary" | Put the summary in the result |
| "Converse to refine" | Go on alone. Ask with a deferred request only when you are stuck. A subagent returns the question to its dispatcher. |
| "When the person confirms" | Skip: no person confirms. The task stays open for a person or a review. |
| A close that needs a person | Do not close. Put the close command in the result. |

- Report progress with `flint orbh session set phase <phase>` and `flint orbh session set progress "<done>/<total> checks"`.
- Phase values: `reading-task`, `creating-task`, `implementing`, `reviewing`, `resolving`, `blocked`, `complete`.
- End each headless workflow with `flint orbh session return --finish "<result>"` only when no parent frame is open. Put the address of each task that the session made or changed in the result.
- **A person message comes first, also in a headless session.** Answer each comment and each chat message of a person in its place before you return (§ The Duty of an Agent Session at a Task). A session that a person started or attached from Ops can return with `--await`: a new comment (with `--subscribe`) or a chat message then wakes it.
- **A child frame does not return.** A workflow of this shard can run as a child frame of another workflow (for example a notepad, or a parent workflow of a headless session). Then the close of its invocation prints `back in: <parent>`, and `flint shard step` shows the parent. Do not return and do not close the session: give the result to the parent frame, and continue it. The session returns when its outermost frame is done.

# What Is Here

## Workflows

| Workflow | Purpose |
|---|---|
| [[dev-wkfl-task-create_task]] | Make a `todo` task, place it with the hint rule, and scope it |
| [[dev-wkfl-task-scope_task]] | Research first, then write the scope and the definition of done into the task note |
| [[dev-wkfl-task-do_task]] | Add the task as an object, work, make the WIP commits, write the result with the commits, ask for the review in Ops, give a summary, then review |
| [[dev-wkfl-task-create_and_do_task]] | Create a task, add it as an object, do it in one run, with the review request in Ops after the result |
| [[dev-wkfl-task-review_task]] | A second session checks the work against the task note, and writes a pass into the result or the findings into the note |
| [[dev-wkfl-task-do_task_group]] | Make or take a task group, add each of its tasks as an object, do each task in it, and ask for the review of each finished task in Ops after its result |

## Skills

| Skill | Purpose |
|---|---|
| [[dev-sk-task-capture_as_task]] | Record work that is already done as a task |
| [[dev-sk-task-use_task]] | Keep a task in the session as an object: add it, read it, take it, return it, and remove it |
| [[dev-sk-task-place_task]] | Apply the placement rule with the hints |
| [[dev-sk-task-split_task]] | Split a task into new parts |
| [[dev-sk-task-merge_tasks]] | Merge tasks into one survivor |
| [[dev-sk-task-continue_task]] | Make a continuation of a task |
| [[dev-sk-task-chain_tasks]] | Chain tasks in an order |
| [[dev-sk-task-group_tasks]] | Make or change a task group |
| [[dev-sk-task-close_task]] | Close a task with its result |

## Knowledge

| Knowledge | Purpose |
|---|---|
| [[dev-knw-task-model]] | The model: C0 to C4 of the contract |
| [[dev-knw-task-cli]] | Each verb of `ops task`, the note scripts, and the verbs of `flint orbh objects` for a task |
| [[dev-knw-task-commits]] | The WIP commit rule: the subject, only your paths, the trailers, and the commits in the result |

## Templates

| Template | Purpose |
|---|---|
| None of its own | A task note uses the template `tmp-proj-task-v0.2` of the Projects shard, with the field `ops`. `task-new` writes it. See [[dev-knw-task-model]] § The Task Note. |
