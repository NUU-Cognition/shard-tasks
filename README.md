# Tasks

**Deprecated since 2026-11-12.** The Operations shard 0.8.0 (`@nuucognition/operations`, shorthand `ops`) holds the work of this shard. Install it with `flint shard install @nuucognition/operations@^0.8`, and load it with `flint shard start ops`. This shard stays published so that an open invocation can finish. It gets no new work.

Tasks in NUU Ops: one task entity with a status and a result, review requests, the people looped in, task groups, lineage, placement, WIP commits, the task as an object of a session, and the duty of an agent session at a task (a person speaks with a comment or in the chat, and the session answers a person first).

This folder is the local source of the Tasks shard (shorthand `task`). It is the agent side of the task primitive v0.1 (Notepad 237, Task 1287) and of the task notes (Task 1291). Each task that the shard makes has two parts, linked both ways: a task note in the Flint (the content, with the type `Task` and the template `tmp-proj-task-v0.2` of the Projects shard) and an Ops task (the state). The shard installs no types, folders, or dashboards of its own.

## Structure

| Folder | Files |
|---|---|
| Root | `dev-init-task.md` (the rules: the hard rule, subtasks, placement, the close, WIP commits), `RELEASE.md` (the release notes) |
| `workflows/` | `create_task`, `scope_task`, `do_task`, `create_and_do_task`, `review_task`, `do_task_group`, each with an invocation file (`shard-invocation/0.3`) |
| `skills/` | `capture_as_task`, `use_task`, `place_task`, `split_task`, `merge_tasks`, `continue_task`, `chain_tasks`, `group_tasks`, `close_task` |
| `knowledge/` | `knw-task-model`, `knw-task-cli`, `knw-task-commits` |
| `scripts/` | `task-new`, `task-link`, `task-sync` (the task notes), `note-lib` (their shared code), and `task-lib` (a copy of the task-lib of the Projects shard 1.7.1) |

## Build

Edit the files here. Then run `flint shard build task` to build the shard in `Shards/Tasks/`. Check it with `flint shard status task --health`.

## Dependencies

The commands `ops task …` (the CLI `ops` of repo `main`) and `flint orbh objects …` (Orbh, the Objects Protocol). Agents use the production CLI `ops`, and the scripts run it by default. For work on the dev deployment of Ops, see `knw-task-cli` § Work on Dev.
