---
description: "The commands of the task primitive: each verb of ops task with one line each, the note scripts task-new, task-link, and task-sync, the refs, the JSON outputs, the limits, the verbs of flint orbh objects for a task, the production CLI ops, and a note on work on dev"
---

# Knowledge: The Task CLI

This file lists each command of the task primitive v0.1: the verbs `ops task …` of the CLI `ops` (section C7 of the contract of Task 1287), the note scripts of Task 1291 (section N6), and the verbs `flint orbh objects …` that keep a task in an Orbh session (the Objects Protocol). The model is in [[dev-knw-task-model]]. `ops task <verb> --help` and `flint orbh objects <verb> --help` give each flag.

## The CLI ops

- Use `ops` for task work: the production build on the PATH. Its data mode is always `prod` (the web app `https://ops.nuucognition.com`). `ops whoami` shows the data mode and the org.
- The note scripts run the command in `NUU_OPS_CLI`, default `ops`. Leave `NUU_OPS_CLI` unset, so that the scripts and the `ops` commands of the session use one deployment.
- In this shard, `ops` means the production CLI.

### Work on Dev

Use the dev deployment only for work on Ops itself, for example a test of a new verb or a fix before its deploy. A task of dev does not exist on production: do not mix the two in one session.

- The dev launcher is the file `apps/cli-ops/bin/ops.js` of the repository `main` (`ops-dev` inside the monorepo). It runs the dev build (`dist-dev/`), or the TypeScript source when there is no build or when `OPS_CLI_FORCE_SOURCE=1`. Its data mode is dev (the web app `http://localhost:3088`), unless `ops mode prod` or `OPS_DATA_MODE=prod` says otherwise.
- Run each `ops` command of the session with the dev launcher, and set `NUU_OPS_CLI` to it, so that the note scripts use dev too. A value that names a file runs that file: `NUU_OPS_CLI="<repo main>/apps/cli-ops/bin/ops.js"`. Another value runs in `/bin/sh` with the arguments after it: `NUU_OPS_CLI="node <repo main>/apps/cli-ops/bin/ops.js"`.
- Unset `NUU_OPS_CLI` again when the work on dev ends.

## Refs and Global Flags

- Each verb takes `--org <org>` (a slug, a name, or `me`) and `--json`. With no `--org`, `ops` uses the stored default org (`ops org use <org>`), else the personal workspace.
- `-V` and `--version` are global: they print the version of the CLI. No task verb has a flag `--version`.
- A `<ref>` of a task is a Convex id, an Ops address (`@v1/<org>/task/<id>#ops`; an old address `task.dev/<id>` still resolves), a URL of Ops, or a title. Use the address: a title can match more than one task. (The help of `update` and `start` says "ID, URL, or title", but both read an address too.)
- A `<group>` is the Convex id, the address (`@v1/<org>/taskgroup/<id>#ops`), or the title of a task group.
- The target of `attach` and `detach` is a task or a task group, by id or address. A title there names a task.
- Give the address in a prompt, an object verb, and an attachment. It names the org too.

## Create, Read, and Change

| Command | What it does |
|---|---|
| `ops task create <title> [--repo <name>] [--unplaced \| --section <s> \| --project <p> \| --deliverable <d> \| --deployment <d> \| --parent <task> \| --route [text] \| --master] [--tag <tag>] [--every day\|week\|month] [--note <address> [--note-label <text>]] [--body <md\|->\|--body-file <path>] [--priority <p>] [--assign <member>] [--top]` | Create a task. Since the revamp of ops-command-1021 a task lives in a section: `--project` is its backlog section, `--deliverable` its first open section, `--deployment` its inbox, `--parent` makes a subtask, and `--route` lets Ops pick the place (the output names it). The former `--subsection` and `--folder` still work, hidden. `--repo` adds a `repo` related link (`ops task relate <ref> repo <name>`). `--unplaced` gives no home. With no placement flag, the home is the org master backlog. `--note` sets the note address, and `--note-label` its label. `--body -` reads stdin. The Tasks shard does not call it directly: `task-new` does. |
| `ops task note <ref> <address> [--label <text>]` | Set the task note of a task: the note address and its label. A new address with no label clears the label. |
| `ops task note <ref> --clear` | Remove the note and its label. An undo in the web brings them back. |
| `ops task list [--all] [--unplaced] [--status open\|todo\|doing\|done\|all] [--limit <n>] [present scope flags]` | List tasks. The default status is `open`, and the default limit is 200 tasks. `--all` lists every task of the org, newest first, and reads it page by page. |
| `ops task search <query> [--limit <n>]` | Search the tasks of the org by title (default 25, at most 100). Use it to find a task with the same intent before a create. |
| `ops task show <ref>` | Show a task with its status, owner, the people looped in, result, lineage, task groups, relations, attachments, and open review requests. The text has a line `note  <label, else the address>` and a line with the open link. |
| `ops task update <ref> [--title <t>] [--body <md\|->\|--body-file <path>] [--priority <p\|none>] [--assign <member\|none>]` | A present verb: change the title, the body, the priority, or the owner. |
| `ops task start <ref>` | A present verb: set the status `doing`. |
| `ops task result <ref> "<text>"` | Write the result of the task. `-` reads stdin; `""` clears it. |

The result is also the record of the commits and the session of the work: [[dev-knw-task-commits]].

## Close

| Command | What it does |
|---|---|
| `ops task close <ref> [--result "<text>"]` | Close the task (`done`) at any time. `--result -` reads stdin. A task has no outcome: `--outcome` is an unknown option. |
| `ops task done <ref>` | A present verb: the same as `close` with no result. |
| `ops task reopen <ref>` | A present verb: set `doing`. The result stays. |

## Review

A review request puts a task in the review queue of a person: **Your Reviews** in the web app, with a notification ([[dev-knw-task-model]] § Review Requests). The request also loops the reviewer into the task, unless the reviewer is the owner: the reviewer then hears every comment on the task. The verbs take the task: the CLI finds the open request where you are the reviewer (a verdict) or the requester (a cancel). With no match, the verb writes nothing (exit 2).

| Command | What it does |
|---|---|
| `ops task review request <ref> [--to <member>] [--note "<text>"]` | Ask for a review. With no `--to`, the reviewer is the owner of the task. A second request to the same reviewer changes the note of the open request. The request loops the reviewer into the task. `--note -` reads stdin. |
| `ops task review approve <ref> [--note "<text>"] [--keep-open]` | The reviewer approves. This closes the task, unless `--keep-open`. |
| `ops task review changes <ref> [--note "<text>"]` | The reviewer asks for changes. The task stays open, and a done task opens again. The note goes to the requester. |
| `ops task review dismiss <ref> [--note "<text>"]` | The reviewer dismisses the request. Nothing else changes. |
| `ops task review cancel <ref> [--to <member>]` | The requester withdraws the request. When you asked more than one reviewer, `--to` names one (else `review_ambiguous`). |
| `ops review list [--org <org>] [--state open\|all]` | The review queue of the caller, every org, oldest first. Then the section `you asked for`: the open requests that you asked of other people, each with its reviewer (`--json`: `sent`). |

## Looped In

The people looped into a task follow it beside its owner, and each one hears every comment on it ([[dev-knw-task-model]] § Looped In). A review request loops in the reviewer, and a mention in a comment loops in the mentioned member.

| Command | What it does |
|---|---|
| `ops task loop add <ref> <person>` | Loop a member of the org into the task. `<person>` is `me`, or a member as `--assign` takes it. The person gets a notification. A person in the loop already changes nothing. A task loops in at most 50 people (`loop_full`). |
| `ops task loop remove <ref> <person>` | Take a person out of the loop of the task. A person who is not in it changes nothing. |

## Placement

| Command | What it does |
|---|---|
| `ops task home <ref> (--section <s> \| --backlog [--project <p>] \| --none)` | Set the one home. `--project` implies `--backlog`; `--backlog` with no project is the org master backlog (the backlog section of the org). `--none` makes the task unplaced. For every other place (a deliverable, a deployment inbox, under a parent task) and for many tasks at once, use `ops task move <tasks...> --to <place>`: it moves the subtree too. |
| `ops task relate <ref> <kind> <ref2> [--label <text>]` | Add a `related` link. `<kind>` is `project`, `deliverable`, `repo`, `flint`, or `address`. `<ref2>`: a project or a deliverable by id, URL, or title (use the id: a title can repeat across projects and refuse with `deliverable_ambiguous`); a repository by name; a Flint by id; a v1 address. A second add of the same link changes nothing. |
| `ops task unrelate <ref> <kind> <ref2>` | Remove a `related` link. |
| `ops task hints [--flint <id>] [--repo <name>] [--text "<text>"]` | Give at most 20 homes for a task, best first. Each hint has `home` (`{kind: "subsection", subsectionId}` for a section, the service word, or `{kind: "backlog", projectId}`), `deliverableId` (when the home is a section of a deliverable), `label`, `reason` (`flint`, `repo`, or `text`), and `score`. |

The Flint id is `flint.id` of `flint org show --json`.

## Lineage

| Command | What it does |
|---|---|
| `ops task split <ref> --part "<title>" [--part "<title>" ...] [--keep-open]` | Split the task into new parts. An open old task closes, unless `--keep-open`. |
| `ops task merge <ref> <ref>... (--into <ref> \| --title "<title>")` | Merge the tasks into a survivor: the `--into` task, or a new task with `--title` (it gets the home of the first task). |
| `ops task continue <ref> [--title "<title>"]` | Make a continuation of the task (default title `<old title> (continued)`). An open old task closes. |
| `ops task chain <ref> <ref> [<ref>...]` | Chain two or more tasks in this order: each task is `after` the task before it. |
| `ops task unchain <ref>` | Remove the `after` link of the task. The tasks after it keep their links. |

## Attachments

| Command | What it does |
|---|---|
| `ops task attach <target> <kind> <ref2> [--session-id <id>] [--label <text>] [--state <state>]` | Attach a session, a fleet, a note, or a repository to a task or a task group. A second attach of the same row updates its label and its state. |
| `ops task detach <target> <kind> <ref2>` | Detach the row. The row stays as history. |

The `ref2` of a session is its session address: `@v1/<org>/session/<uuid>#flint/<slug>#<machine>`.

## Task Groups

| Command | What it does |
|---|---|
| `ops task group create <title> [--task <ref> ...] [--body <text>]` | Create a task group, with tasks or empty. |
| `ops task group add <group> <ref>...` | Add tasks to the task group. |
| `ops task group remove <group> <ref>...` | Remove tasks from the task group. The tasks stay. |
| `ops task group show <group>` | Show the task group: its address, its tasks, open or closed, and its attachments. |
| `ops task group list [--open]` | List the task groups of the org, newest first, with their counts and `open`. |
| `ops task group delete <group>` | Delete the task group and its members. The tasks stay. |

## JSON Outputs

| Command | The keys of `--json` |
|---|---|
| `show` | `address`, `note`, `noteLabel`, `noteUrl` (each `null` when the task has no note), `task` (the row with `checkbox`, `result`, `unplaced`, `homeLabel`, `groupIds`, `chainReady`, `loopedIn`, …), `links`, `groups`, `relations`, `attachments`, `launches`, `breadcrumb`, `orgSlug`, `url`, `loopedIn` (each `{userId, name}`), `reviews` |
| `create` | `id`, `address`, `orgSlug`, `title`, and the placement; with `--note`, also `note`, `noteLabel`, and `noteUrl` |
| `note` | `taskId`, `address`, `note`, `noteLabel`, `noteUrl` (each note field `null` after `--clear`) |
| `split` | `id` (the old task), `taskIds`, `tasks` (each `{id, title, address}`), `keepOpen` |
| `merge` | `taskId` (the survivor), `address`, `title`, `absorbed`, `created` |
| `continue` | `id` (the old task), `taskId` (the new task), `address`, `title` |
| `group create` | `groupId`, `address`, `orgSlug`, `title`, `taskIds` |
| `group show` | `address` (always the Ops address of the task group), `group`, `tasks` (summaries), `open`, and `attachments` |
| `attach` | `attachmentId`, `target: {kind: "task"\|"taskgroup", id, address}` |

**A failed read after a write.** `create`, `split`, `merge`, `continue`, `attach`, and `group create` read the address after the write. When that read fails, the command still exits 0: the output has the new id with `address: null`, and a note on stderr says that the write is done and names the read to run. **Do not run the write again.** Run the read that the stderr message names (for example `ops task show <id> --json`) to get the address.

## The Note Scripts

The Tasks shard makes and keeps the task notes with three scripts (`flint shard task <script>`). Each script prints one JSON document on stdout. A refusal prints the reason on stderr, changes nothing, and exits 1. The scripts run `ops` through `NUU_OPS_CLI` (default `ops`), and `flint` for the number and the note address.

| Script | Command | What it does |
|---|---|---|
| `task-new` | `flint shard task task-new "<title>" [--repo <name>] [--org <org>] [--unplaced \| --subsection <s> \| --project <p> [--folder <f>] \| --master] [--priority <p>] [--assign <member>] [--body-file <path>]` | (`--subsection` names a section: the script passes it to `ops task create`.) Writes the task note (`flint helper artifact create Task` reserves the number), gets the note address (`flint resolve @v1//task/<n> --json`), makes the Ops task with `--note` and `--note-label "Task <n> · <Flint name>"` and no body, and writes `ops` into the note. With no placement option, the Ops task is unplaced. `--repo <name>` passes `--repo` to `ops task create` (the `repo` related link), and writes the name into `git-repos` of the note. `--body-file` gives the body of the note (no frontmatter); else the note has the headings of the template. |
| `task-new --ops` | `flint shard task task-new ["<title>"] --ops <ref> [--org <org>] [--body-file <path>]` | Writes the note of an Ops task that exists and has no note (a part of a split, a continuation, the new survivor of a merge with `--title`, a task from the web), links it with `ops task note`, and copies the state of the Ops task into the note (as `task-sync`). The title comes from the Ops task, unless a title is given. It refuses the options of a new Ops task, and an Ops task that already has a note. |
| `task-link` | `flint shard task task-link "<(Task) N Title>" [--ops <ref>] [--org <org>] [--repo …] [placement] [--priority <p>] [--assign <member>]` | Links a note that exists. With `--ops`: it sets the note of that Ops task, writes `ops` into the note, and copies the state of the Ops task into the note (as `task-sync`). With no `--ops` and a note with `ops`: it links the same Ops task again (a repair), and copies the state too. With no `--ops` and no `ops`: it makes the Ops task. It refuses a note that links another Ops task, and an Ops task that has another note. |
| `task-sync` | `flint shard task task-sync "<(Task) N Title>"`, or `flint shard task task-sync <Ops address>` | Reads the Ops task and writes `status`, `completed`, and `ops` into the note (the map of the status is in [[dev-knw-task-model]] § The Task Note). It clears the old fields `task-type` and `stage` when the note has a value in them. A change of the status adds a Task Log line. With an Ops address, it finds the note through the field `note` of Ops. |

The JSON of each script:

| Script | Keys |
|---|---|
| `task-new` | `number`, `title`, `path`, `note`, `noteLabel`, `ops` |
| `task-link` | `number`, `title`, `path`, `note`, `noteLabel`, `ops`, `created` |
| `task-sync` | `number`, `title`, `path`, `ops`, `status`, `changed` (the fields that changed), `noteLinked` (`true` when the Ops task names this note) |

**When the Ops part fails.** `task-new` keeps the note and prints the JSON with `ops: null`, `error`, and `next`, with exit 1. Each word of a command in the output is quoted for a POSIX shell. `next` depends on the outcome of the create:

| Outcome | How the script knows it | `next` |
|---|---|---|
| Ops refused the create, and wrote nothing | The code of the JSON error of `ops` is in a fixed list of codes that come before any write: a usage error, a login error, a ref that does not resolve (`…_not_found`, `…_ambiguous`), a refusal of the gateway before the mutation, or a refusal of the mutation `tasks.create` (for example `task_note_invalid`). The HTTP status is not used | `task-link` with each option of the run (`--org`, `--repo`, the placement, `--priority`, `--assign`) |
| The create made the task, and a step after it failed | The message `Created task <id>, but <part> failed: …` | `task-link … --ops <id>`; `opsId` is the task. `error` gives the step for the failed part (for the repo link: `ops task relate <id> repo <name>`) |
| Not known (a network error, a time-out, `bad_response`, `agent_error`, an unknown code, no JSON error) | Any other failure, whatever the HTTP status | A search in the org of the create (`--org`, else the org of the placement address, else the active org): `ops task search "<title>" [--org <org>] --json`. Read the note of each task of the search (`ops task show <id> --json`): the task with the note of this note is the task, so run `ifFound` (`task-link … --ops <id>`). There is no create command: a search can miss a task. Do not create the task again until a person or the agent has checked the Ops tasks of the org by hand |

A script never runs an Ops create two times: after an `address: null`, it reads the address with `ops task show`. When the outcome of a create is not known, check the Ops tasks before a second create.

- The scripts never show the raw output of `ops`, and never show the value of `NUU_OPS_CLI`: a launcher in the shell form can hold a credential. A failure of `ops` gives the code, the message, and the hints of its JSON error document (`--json` writes exactly one on stderr). With `NUU_OPS_CLI` in the shell form (a value that is not the path of one file), it gives only the code and the words "run the ops step by hand to see the message". Another failure (for example a `/bin/sh` error, or a launcher that fails before `ops` runs) gives a fixed text with the exit code. In the shell form, the message text of an error or a refusal also loses each literal occurrence of the value of `NUU_OPS_CLI` (for a value with a space or an `=`). Data (an address, an id, `next`, `ifFound`) never changes.
- The scripts do not trim `NUU_OPS_CLI`. A value with a space at its start or its end is a refusal, before any write.
- A description of a call names `<ops>` as `ops`, or as the file name when `NUU_OPS_CLI` names a file. It is not a command to run.
- A command to run is a `flint shard task …` command (the scripts read `NUU_OPS_CLI`), or an `ops` step. When `NUU_OPS_CLI` is set, the step names it: `"$NUU_OPS_CLI" task …` for a file, `sh -c "$NUU_OPS_CLI"' "$@"' sh task …` for the shell form. Run it in a shell with the same `NUU_OPS_CLI`. Do not run a step with the `ops` on the PATH while `NUU_OPS_CLI` names another deployment.

- A local Flint (no org) has local note addresses (`@v1//…`), and Ops refuses them. The scripts refuse before any write: give the Flint an org first (`flint org set <org>`).
- The number of a note has the padding of the Flint (`(Task) 007` in a new Flint, `(Task) 1291` in the NUU Flint). The label uses the same text: `Task 007 · <Flint name>`.

## Limits

| Limit | Value |
|---|---|
| Task groups of one task | At most 20 |
| Tasks of one task group | At most 50 |
| Relations of one task | At most 100 |
| Live attachments of one task or task group | At most 100 |
| `ops task list` | 200 tasks by default; `--all` reads the whole org page by page |
| `ops task hints` | At most 20 hints |
| `ops task search` | 25 by default, at most 100 |

A write over a limit refuses with a code of [[dev-knw-task-model]] § Error Codes.

## The Task as an Object (Orbh)

An Orbh session keeps a task in its context as an object of the Objects Protocol. The reference of each verb is `knw-foh-cli` § Objects of the Orbh shard, and the rules of a use are in its skill `sk-foh-use_object`. [[dev-sk-task-use_task]] gives the steps for a task.

| Command | What it does |
|---|---|
| `flint orbh objects add <task address> --subscribe` | Add the task to the session as an item. The mode `link` is the default: the session reads the task again at each turn boundary. `--subscribe` sends a message from `orbh:objects` when the task changes. It prints the block of the item, with its id (`ob-…`). |
| `flint orbh objects list` | List the items: the id, the mode, the state, the version, and the address. |
| `flint orbh objects show <id> [--full]` | Show the block of an item: a fresh read of the task, with its hold. |
| `flint orbh objects get <task address> [--describe]` | Read the task one time, with no item. |
| `flint orbh objects take <task address>` | Take the task: only this session changes it while the hold lasts. `chair` is the soft hold: the sessions that it answers with `share` change it too. |
| `flint orbh objects return <task address>` | End the hold. |
| `flint orbh objects request <task address> --note "<why>"` | Ask the holder for the hold, after a verb answered `held` (exit 9). |
| `flint orbh objects remove <id>` | Remove the item when the work no longer needs the task. Its record stays as a tombstone. |

- A session holds at most 20 items. Add each task that the work uses.
- **A task group.** Do not add the task group: its object does not resolve. Add each task of the task group as an object (at most 20 items).
- Take or chair the task only for a change that must not collide (a series of mesh writes, or a result and a close), and return it after the change. A hold is a lease (600 s by default). Orbh renews each hold while the session lives, and returns it at the end of the session.
- When a verb answers `held` (exit 9), another actor holds the task. Send a `request`, and do not get around the hold.
- The Page shows each item in the `OBJECTS` block. A changed task shows its full block with `state: changed`. A hold shows in the part `Holds (<n>)`.
- A dispatcher gives a task to a new session at the launch: `flint orbh launch … --object <task address>=subscribe`.
- **A task after an undo.** An undo of the delete of a task can give the task a new id. Ops records the move, so `ops task show <old address> --json` gives the task with its new canonical address. Add the new address as an object, and remove the item of the old address. Use the new address from then on.
- The commit hook adds the trailers `Orbh-Fleet` and `Orbh-Session`. The subject of the commit names the task.
