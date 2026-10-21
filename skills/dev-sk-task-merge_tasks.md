---
description: "Merge two or more tasks into one survivor with ops task merge: the other tasks get merged-into and close as superseded"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start task` if you haven't already.

# Skill: Merge Tasks

Merge tasks that have one intent (for example, two tasks for the same fault) into one task.

# Input

- The refs of the tasks (two or more)
- The survivor: one of the tasks (`--into <ref>`), or a new task with a title (`--title "<title>"`)

# Actions

1. **Read each task.** Run `ops task show <ref> --json` for each, and read each task note. Check that the tasks have one intent. Tasks that are only done together are a task group, not a merge: use [[dev-sk-task-group_tasks]].
2. **Choose the survivor.** Prefer the task with the most history (stages, commits, attachments): use `--into <ref>`. Use `--title "<title>"` only when no task can be the survivor. Then Ops makes the survivor as a new task, with the home of the first task, and step 4 makes its note.
3. **Merge.**
   ```bash
   ops task merge <ref> <ref> [<ref>...] (--into <ref> | --title "<title>") --json
   ```
   Each other task gets `merged-into` the survivor, and an open one closes with `superseded`. The output gives the survivor as `taskId` and `address`. When the output has `address: null`, the write is done: do not run it again. Run the read that the stderr message names (`ops task show <id> --json`) to get the address.
4. **Join the notes.**
   - **With `--into`:** merge makes no new task. Write the context, the scope, and each item of the definition of done of the merged tasks into the task note of the survivor.
   - **With `--title`:** Ops made the survivor, and it has no note yet. Each task that the shard makes has a note (N6 of Task 1291, with the amendment of 2026-10-20), so make it now: write the joined text to a temporary file, and run `flint shard task task-new --ops <survivor address> --body-file <file>`. Do not run `task-new` with a title: that makes a second Ops task. `task-new --ops` links the survivor and copies its state into the note.

   Then sync each note: `flint shard task task-sync <address>` for the survivor and for each merged task (an open one becomes `superseded`). Add a `# Task Log` line in each merged note with the survivor.
5. **Join the fields.** When the survivor is a `task.dev`, add the WIP commits of the merged tasks to it: `ops task commit <survivor> <sha> --repo <name>` for each. When the survivor is untyped, `ops task commit` refuses (`task_untyped`): name the commits in its result.
6. **Pin again.** When the session pinned a merged task, pin the survivor: `flint orbh task pin <survivor address>`.
7. Report the address and the note of the survivor and of each merged task.

# Output

- One survivor with the joined task note
- Each other task with `merged-into` the survivor, closed `superseded` when it was open
