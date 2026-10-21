---
description: "Record work that the session already did as an Ops task: create it, place it, pin it, record the commits, and close it or leave it for review"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start task` if you haven't already.

# Skill: Capture As Task

Record the recent work of the session as a task in Ops, when the work started with no pin.

# Input

- The work that the session did: the changes, the commits, and the result
- (Optional) A title or a place that the person gives

# Actions

1. **Check for a task first.** When an open task already has this intent, do not create a task: pin it ([[dev-sk-task-pin_task]]), and record the work on it. Use `ops task search "<words of the title>" --json` and `ops task hints --text "<title>"` to find it.
2. **Choose the type.** Use `task.dev` when the work changed code in a repository. Else use the base type (no `--type`). When step 1 found an untyped task and the work changed code, retype it: `ops task retype <address> task.dev --json`, then set its repository (`ops task field <address> repo <name>` and `ops task relate <address> repo <name>`). Use the `address` of the output from then on. Do not make a new task for it. Then go to step 5.
3. **Create the task.** Write the body of the task note to a temporary file outside the Mesh: `# Context`, `# Task Description`, `# Task Requirements`, `# Definition of Done` (ticked, as the work was done), `# Task Log`, and `# Notes`, with no frontmatter (see [[dev-knw-task-model]] § The Task Note). Then create the task with its note:
   ```bash
   flint shard task task-new "<title>" [--type task.dev --repo <name>] [--org <org>] --body-file <file>
   ```
   Keep the field `ops` of the output (the Ops address, `<address>` below). When `ops` is `null`, the note exists and the Ops part failed: fix the cause, then run the command of `next`. Never run `task-new` again for the same work.
4. **Place it** with [[dev-sk-task-place_task]].
5. **Pin it**: `flint orbh task pin <address>`. The pin records this session on the task.
6. **Record the commits.**
   - `task.dev`: for each commit of the work, run `ops task commit <address> <sha> --repo <name>`.
   - Untyped task (also a task that exists from step 1): do not run `ops task commit`. An untyped task has no field `wipCommits`, so the command refuses with `task_untyped`. Name the commits in the result in step 7, as `<sha> (<repo>)`.
7. **Set the state.**
   - `task.dev`: set `ops task stage <address> built --note "<summary>"`. Do not close it: a review sets `reviewed` first ([[dev-wkfl-task-review_task]]).
   - Untyped task: write the result with the commits (`ops task result <address> "<summary>. Commits: <sha> (<repo>), …"`). Close it with `completed` when the person confirms ([[dev-sk-task-close_task]]). In a headless session, close it only when the prompt says so.
8. **Copy the state into the note:** `flint shard task task-sync <address>` (also after a close).
9. Report the address, the note, the place, the commits, and the state to the person (or in the result).

# Output

- A task note and an Ops task, linked both ways, with the work, its place, its commits, and the session attachment
- A `task.dev` at `built`, or an untyped task with its result (closed when confirmed)
