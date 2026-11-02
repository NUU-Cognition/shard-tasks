---
description: "Close a task with one of the three outcomes (completed, dropped, superseded), at any time"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start task` if you haven't already.

# Skill: Close Task

Close a task with the correct outcome, and write its result.

# Input

- The ref of the task
- The outcome: `completed`, `dropped`, or `superseded`
- The result: one or two sentences about what the task gave, or why it stopped

# The Outcomes

| Outcome | When to use |
|---|---|
| `completed` | The work is done, and it meets the definition of done |
| `dropped` | The work stops, and no task takes it |
| `superseded` | Another task takes the work. Prefer [[dev-sk-task-split_task]], [[dev-sk-task-merge_tasks]], or [[dev-sk-task-continue_task]]: they close the old task with `superseded` and keep the link. |

`ops task close` closes a task with each outcome at any time.

# Actions

1. **Read the task.** Run `ops task show <ref> --json`. Read the status, the result, and the definition of done in the task note (a task with no note: in its body).
2. **Check the outcome.**
   - For `completed`, check each item of the definition of done.
   - When the person wants a review before the close, the review comes first: [[dev-wkfl-task-review_task]]. Do not review your own work.
3. **Ask when a person must decide.** In an interactive session, ask the person before each close with `completed`, and before each `dropped` close. In a headless session, close only when the prompt says so. Else put the close command in the result.
4. **Close.** Run `ops task close <ref> --outcome <outcome> --result "<result>"`. (`ops task done <ref>` is the same as `--outcome completed`, with no result.) The result names the commits of the work: when the task has a result already, keep its text in the new result, or give no `--result`.
5. **Sync the note.** After the close, run `flint shard task task-sync <ref>`: the note gets `done`, `deprecated`, or `superseded`, and the date. Add a `# Task Log` line with the result.
6. **After the close.** Keep the task object while the session reports on the task. Remove it with `flint orbh objects remove <id>` when the work no longer needs it. A chain shows the next task as ready.
7. **Reopen.** When a done task needs more work in the same scope, the person can ask for `ops task reopen <ref>`: it sets `doing`, and clears the outcome. Then run `flint shard task task-sync <ref>`. For new scope, use [[dev-sk-task-continue_task]].

# Output

- The task is `done` with its outcome and result
- Or the next step, in the conversation or the result
