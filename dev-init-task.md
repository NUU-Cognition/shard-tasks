---
required-reading:
  - "[[dev-knw-task-model]]"
  - "[[dev-knw-task-cli]]"
---

# Tasks

The Tasks shard gives agents one way to work with the tasks of NUU Operations (Ops). Each task that the shard makes has two parts, linked both ways: a task note in this Flint holds the content, and an Ops task holds the state. Orbh sessions, Strike, and Trident attach to the Ops task.

## Required Reading

| File | Why |
|---|---|
| [[dev-knw-task-model]] | The model: the terms, the fields, the status, the stages, the close rules, lineage, task groups, and placement |
| [[dev-knw-task-cli]] | Each command of `ops task`, `flint orbh task`, and the scripts `task-new`, `task-link`, and `task-sync` |

Read [[dev-knw-task-dev]] too before you work on a `task.dev`.

## Terms

| Term | Meaning |
|---|---|
| task | One row of the Ops table `tasks`. Any coherent unit of work. Its size does not matter. |
| task note | The Flint note of a task: `Mesh/Types/Tasks/(Task) <n> <title>.md` with the tag `#proj/task`. It holds the content. |
| note address | The address of a task note: `@v1/<org>/task/<note id>#flint/<flint>`. Ops keeps it in the field `note`. |
| status | The Ops `checkbox`: `todo`, `doing`, or `done`. Every task has one. `blocked` is a flag. |
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

The full model is in [[dev-knw-task-model]], and each command is in [[dev-knw-task-cli]].

## Two Parts: the Task Note and the Ops Task

Each task that this shard makes has two parts, linked both ways:

| Part | Where | It holds | The link |
|---|---|---|---|
| Task note | `Mesh/Types/Tasks/(Task) <n> <title>.md`, from the template `tmp-proj-task-v0.2` of the Projects shard | The content: the context, the requirements, the definition of done, the Task Log, and the notes | Its field `ops` holds the Ops address |
| Ops task | NUU Ops | The state: the status, the stage, the outcome, the type and its fields, the place, the lineage, the task groups, and the attachments | Its field `note` holds the note address, and its body stays empty |

- **Make each task with `task-new`:** `flint shard task task-new "<title>" …`. It writes the note, makes the Ops task, and links both. Do not make an Ops task alone with `ops task create`, and do not write a task note by hand.
- **Ops owns the state.** Ops owns the status, the stage, and the outcome. `flint shard task task-sync <ref>` copies them (and the type) into the note, in one direction only. Do not edit `status`, `stage`, `task-type`, `completed`, or `ops` of the note by hand: change the Ops task, then run `task-sync`.
- **A task with no note.** A task that a person makes in the web, or that Strike makes, has no note and keeps its body. Give it a note with `flint shard task task-new --ops <ref>`. Link a note that exists with `flint shard task task-link "<(Task) N Title>" [--ops <ref>]`.
- **The Ops address stays the key.** The pin, the invocation input `task`, the attachments, and the commit trailer use the Ops address. Ops shows the note as "Open in Obsidian".
- Ops holds all views of tasks. The Flint has no task dashboard of this shard.
- To keep another Mesh note with a task (a notepad, a report), attach it: `ops task attach <ref> note "<Mesh path>"`.
- The Projects shard does not change: its workflows make task notes with no Ops task. Do not mix the two shards on one task.

## The Hard Rule

**Before work that changes a file or makes an artifact, the session pins a task or a task group:**

```bash
flint orbh task pin <ref>
```

- When no task fits the work, create one with `task-new` ([[dev-wkfl-task-create_task]], or [[dev-wkfl-task-create_and_do_task]] to create and do it). Then pin its Ops address.
- Check the pin with `flint orbh task show`. The Page of the session shows the `TASK` line.
- Reading, research with no artifact, and an answer in the conversation need no pin.
- A session pins one task or one task group at a time. A second pin moves the old pin to `previous`, and the old Ops attachment stays. So a session can do two tasks one after the other, or many tasks at one time through a task group.
- When you dispatch a subagent for the pinned work, put the address of the task in the prompt. The subagent pins the same address.
- The pin reads the task in Ops first. When Ops does not resolve the ref, the pin refuses and changes nothing: check the ref with `ops task show <ref>`.
- When only the attach in Ops fails, the pin is set as `sync pending`. Continue the work, and run `flint orbh task sync` later.
- `flint orbh task unpin` makes no Ops call: the Ops attachment stays.

[[dev-sk-task-pin_task]] gives the steps.

## Task or Subtask

- When new work serves the intent of the pinned task, it is a **subtask** of that task: a Strike target mounted on the Ops task. It is not a new task.
- When the work does not serve that intent, it is a **new task**. Create it, or pin the task that fits.
- Ops does not show subtasks. Strike shows the subtasks and the steps of a task.

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
- A `task.dev` always has the `repo` link. `ops task create --repo <name>` adds it at the create. When the field `repo` came in another way (`ops task field <ref> repo <name>`), add it: `ops task relate <ref> repo <name>`. The hints of `--repo` read these links.

[[dev-sk-task-place_task]] gives the steps.

## Lifecycle: Status, Outcome, and Close

```
todo → doing → done (completed | dropped | superseded)
          ↑       │
          └───────┘ reopen
```

- A close has one outcome: `completed`, `dropped`, or `superseded`.
- `completed` on a typed task needs a stage that can close. Else `ops task close` refuses with `task_stage_not_closable`.
- `dropped` and `superseded` are allowed at any stage. An untyped task closes at any time.
- A reopen sets `doing`, clears the outcome, and keeps the stage.
- After each change of the Ops state (a start, a stage, a close, a reopen, a type change), run `flint shard task task-sync <ref>`, so that the note shows the state.

[[dev-sk-task-close_task]] gives the steps.

## The Type task.dev

`task.dev@0.1` is the software development task. Use it for work that changes code in a repository. Read [[dev-knw-task-dev]] before you work on one.

- **Fields:** `repo` (the repository, a plain name) and `wipCommits` (the SHAs of the WIP commits).
- **Stages:** `scoped` → `built` → `reviewed` → `verified`. The order is for display: any stage can follow any stage.
- `scoped`: the note has the scope and the definition of done. `built`: the work is done and committed. `reviewed`: a second session checked the work. `verified`: a person checked the work.
- **Only a person sets `verified`.** An agent never sets it. A write from an Orbh session refuses with `task_stage_forbidden`.
- A `task.dev` closes with `completed` at `reviewed` or at `verified`. Ops shows `done · Reviewed` or `done · Verified`.
- **The type can change (rule C4.8).** `ops task retype <ref> task.dev` or `ops task retype <ref> --none`, on a task that is not done (a done task refuses with `task_type_done`). The stage and the fields stay only when the new type defines them. The address follows the type, and the old address still resolves. When a task needs a type after its create, retype it: do not make a new task.
- Remove a WIP commit with `ops task field <ref> wipCommits "<item>" --remove`, never with a `set` of the whole list.
- **WIP commits.** Pin the task before the first edit. Commit only your paths on the machine branch, with the subject `[OR] wip: <Flint name>/Task <short id> <what changed>` (the short id is the first 8 characters of the Ops id). The hook adds the trailer `Task: <address>` from the pin (with a task group pin, it names the task group). After each commit, record it: `ops task commit <ref> <sha> --repo <name>`. Only a type with the field `wipCommits` (`task.dev`) takes `ops task commit`. An untyped task refuses it with `task_untyped`: name its commits in its result. Ops holds the commits: the field `wip-commits` of the note stays empty.

## The CLI ops

Use `ops` (production) for task work. Ops production has the task primitive, and the production `ops` has each verb of this shard. `flint orbh task` runs `ops` by default, so leave `NUU_OPS_CLI` unset. The web app is `https://ops.nuucognition.com`. In this shard, `ops` means the production CLI.

Use the dev deployment only for work on Ops itself, for example a test of a new verb before its deploy. Then the pin and each `ops` command use the dev launcher: [[dev-knw-task-cli]] § Work on Dev.

## Scripts

| Script | Command | Output (JSON) |
|---|---|---|
| task-new | `flint shard task task-new "<title>" [--type <type>] [--repo <name>] [--org <org>] [--unplaced \| --subsection <s> \| --project <p> [--folder <f>] \| --master] [--priority <p>] [--assign <member>] [--body-file <path>]` | `{ number, title, path, note, noteLabel, ops }` |
| task-new for an Ops task that exists | `flint shard task task-new ["<title>"] --ops <ref> [--org <org>] [--body-file <path>]` | The same |
| task-link | `flint shard task task-link "<(Task) N Title>" [--ops <ref>] [--org <org>] [create options]` | `{ number, title, path, note, noteLabel, ops, created }` |
| task-sync | `flint shard task task-sync "<(Task) N Title>"`, or the Ops address | `{ number, title, path, ops, status, stage, type, changed, noteLinked }` |

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
- **A child frame does not return.** A workflow of this shard can run as a child frame of another workflow (for example a notepad, or a parent workflow of a headless session). Then the close of its invocation prints `back in: <parent>`, and `flint shard step` shows the parent. Do not return and do not close the session: give the result to the parent frame, and continue it. The session returns when its outermost frame is done.

# What Is Here

## Workflows

| Workflow | Purpose |
|---|---|
| [[dev-wkfl-task-create_task]] | Make a `todo` task, place it with the hint rule, and scope it |
| [[dev-wkfl-task-scope_task]] | Research first, then write the scope into the task note, and set `scoped` |
| [[dev-wkfl-task-do_task]] | Pin, work, record the WIP commits, set `built`, give a summary, then review |
| [[dev-wkfl-task-create_and_do_task]] | Create, pin, and do a task in one run |
| [[dev-wkfl-task-review_task]] | A second session checks the work against the task note, and sets `reviewed` or writes the findings |
| [[dev-wkfl-task-do_task_group]] | Make or take a task group, pin it, and do each task in it |

## Skills

| Skill | Purpose |
|---|---|
| [[dev-sk-task-capture_as_task]] | Record work that is already done as a task |
| [[dev-sk-task-pin_task]] | Pin a task or a task group to this session |
| [[dev-sk-task-place_task]] | Apply the placement rule with the hints |
| [[dev-sk-task-split_task]] | Split a task into new parts |
| [[dev-sk-task-merge_tasks]] | Merge tasks into one survivor |
| [[dev-sk-task-continue_task]] | Make a continuation of a task |
| [[dev-sk-task-chain_tasks]] | Chain tasks in an order |
| [[dev-sk-task-group_tasks]] | Make or change a task group |
| [[dev-sk-task-close_task]] | Close a task with one of the three outcomes |

## Knowledge

| Knowledge | Purpose |
|---|---|
| [[dev-knw-task-model]] | The model: C0 to C4 of the contract |
| [[dev-knw-task-cli]] | Each verb of `ops task` and `flint orbh task` |
| [[dev-knw-task-dev]] | `task.dev@0.1`: the fields, the stages, and the WIP commit rule |

## Templates

| Template | Purpose |
|---|---|
| None of its own | A task note uses the template `tmp-proj-task-v0.2` of the Projects shard, with the fields `ops`, `task-type`, and `stage`. `task-new` writes it. See [[dev-knw-task-model]] § The Task Note. |
