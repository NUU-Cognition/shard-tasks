# Tasks

Tasks in NUU Ops: one task entity with types, stages, task groups, lineage, placement, and session pins.

This folder is the local source of the Tasks shard (shorthand `task`). It is the agent side of the task primitive v0.1 (Notepad 237, Task 1287) and of the task notes (Task 1291). Each task that the shard makes has two parts, linked both ways: a task note in the Flint (the content, with the type `Task` and the template `tmp-proj-task-v0.2` of the Projects shard) and an Ops task (the state). The shard installs no types, folders, or dashboards of its own.

## Structure

| Folder | Files |
|---|---|
| Root | `dev-init-task.md` (the rules: the hard rule, subtasks, placement, `task.dev`) |
| `workflows/` | `create_task`, `scope_task`, `do_task`, `create_and_do_task`, `review_task`, `do_task_group`, each with an invocation file (`shard-invocation/0.3`) |
| `skills/` | `capture_as_task`, `pin_task`, `place_task`, `split_task`, `merge_tasks`, `continue_task`, `chain_tasks`, `group_tasks`, `close_task` |
| `knowledge/` | `knw-task-model`, `knw-task-cli`, `knw-task-dev` |
| `scripts/` | `task-new`, `task-link`, `task-sync` (the task notes), `note-lib` (their shared code), and `task-lib` (a copy of the task-lib of the Projects shard 1.7.1) |

## Build

Edit the files here. Then run `flint shard build task` to build the shard in `Shards/Tasks/`. Check it with `flint shard status task --health`.

## Dependencies

The commands `ops task …` (the CLI `ops` of repo `main`) and `flint orbh task …` (Orbh). Agents use the production CLI `ops`, and `flint orbh task` runs it by default. For work on the dev deployment of Ops, see `knw-task-cli` § Work on Dev.
