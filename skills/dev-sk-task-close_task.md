---
description: "Close a task with its result, at any time: a task has no outcome, and a done task is done"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start task` if you haven't already.

# Skill: Close Task

Close a task, and write its result.

# Input

- The ref of the task
- The result: one or two sentences about what the task gave, or why it stopped

# When to Close

| Case | What to do |
|---|---|
| The work is done, and it meets the definition of done | Close the task. The result names the commits of the work. |
| The work stops, and no task takes it | Close the task. The result says that the work stopped, and why. |
| Another task takes the work | Prefer [[dev-sk-task-split_task]], [[dev-sk-task-merge_tasks]], or [[dev-sk-task-continue_task]]: they close the open old task and keep the link. |

A task has no outcome (removed 2026-11-04): a done task is done. `ops task close` closes a task at any time. Do not pass `--outcome`: the CLI refuses it.

# Actions

1. **Read the task.** Run `ops task show <ref> --json`. Read the status, the result, and the definition of done in the task note (a task with no note: in its body).
2. **Check the work.**
   - For work that is done, check each item of the definition of done.
   - When the person wants a review before the close, the review comes first: [[dev-wkfl-task-review_task]]. Do not review your own work.
3. **Ask when a person must decide.** In an interactive session, ask the person before each close. In a headless session, close only when the prompt says so. Else put the close command in the result.
4. **Close.** Run `ops task close <ref> --result "<result>"`. (`ops task done <ref>` is the same, with no result.) The result names the commits of the work: when the task has a result already, keep its text in the new result, or give no `--result`.
5. **Sync the note.** After the close, run `flint shard task task-sync <ref>`: the note gets `done` and the date. Add a `# Task Log` line with the result.
6. **After the close.** Keep the task object while the session reports on the task. Remove it with `flint orbh objects remove <id>` when the work no longer needs it. A chain shows the next task as ready.
7. **Reopen.** When a done task needs more work in the same scope, the person can ask for `ops task reopen <ref>`: it sets `doing`, and keeps the result. Then run `flint shard task task-sync <ref>`. For new scope, use [[dev-sk-task-continue_task]].

# Output

- The task is `done` with its result
- Or the next step, in the conversation or the result
