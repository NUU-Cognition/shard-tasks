---
description: "Close a task with one of the three outcomes (completed, dropped, superseded); completed needs a stage that can close for a typed task"
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

| Outcome | When to use | Stage rule |
|---|---|---|
| `completed` | The work is done, and it meets the definition of done | A typed task needs a stage with `canClose: true`. For `task.dev`: `reviewed` or `verified`. An untyped task closes at any time. |
| `dropped` | The work stops, and no task takes it | Any stage |
| `superseded` | Another task takes the work | Any stage. Prefer [[dev-sk-task-split_task]], [[dev-sk-task-merge_tasks]], or [[dev-sk-task-continue_task]]: they close the old task with `superseded` and keep the link. |

# Actions

1. **Read the task.** Run `ops task show <ref> --json`. Read the status, the type, the stage, and the definition of done in the task note (a task with no note: in its body).
2. **Check the outcome.**
   - For `completed`, check each item of the definition of done.
   - For a `task.dev` with `completed`, the stage must be `reviewed` or `verified`. When it is `built`, the review comes first: [[dev-wkfl-task-review_task]]. Do not set `reviewed` yourself on your own work, and never set `verified`.
3. **Ask when a person must decide.** In an interactive session, ask the person before a close with `completed` of an untyped task, and before each `dropped` close. In a headless session, close only when the prompt says so. Else put the close command in the result.
4. **Close.** Run `ops task close <ref> --outcome <outcome> --result "<result>"`. (`ops task done <ref>` is the same as `--outcome completed`, with no result.)
5. **Sync the note.** After the close, run `flint shard task task-sync <ref>`: the note gets `done`, `deprecated`, or `superseded`, and the date. Add a `# Task Log` line with the result.
6. **When the close refuses** with `task_stage_not_closable`, do not change the stage to pass the check. Report the stage, and say what comes next (the review, or the verify of a person).
7. **After the close.** Keep the pin: the next `flint orbh task pin` moves it to `previous`. A chain shows the next task as ready.
8. **Reopen.** When a done task needs more work in the same scope, the person can ask for `ops task reopen <ref>`: it sets `doing`, clears the outcome, and keeps the stage. Then run `flint shard task task-sync <ref>`. For new scope, use [[dev-sk-task-continue_task]].

# Output

- The task is `done` with its outcome and result, and Ops shows `done · <stage label>` for a typed task
- Or the refusal and the next step, in the conversation or the result
