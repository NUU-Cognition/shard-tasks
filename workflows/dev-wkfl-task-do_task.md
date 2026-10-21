---
description: "Do an Ops task: pin it, do the work, record the WIP commits, set built, give a summary, then hand it to a review"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start task` if you haven't already.

# Workflow: Do Task

Do the work of a task that exists in Ops, from the pin to the review. This is an **execution** workflow.

> [!headless]
> In a headless or subagent Orbh session, no person is at the terminal. Do each stage, and follow the `> [!headless]` callout in it. Do not wait for a person.
> - Report progress with `flint orbh session set phase <phase>` and `flint orbh session set progress "<done>/<total> checks"`. The phase values are in the section `# Headless` of [[dev-init-task]].
> - Never close a task that needs a person. A `task.dev` stays at `built` for the review.
> - End the turn with `flint orbh session return --finish "<result>"` only when no parent frame is open. When this workflow runs as a child frame of another workflow, continue the parent frame after the close (see the section `# Headless` of [[dev-init-task]]).

# Invocation

You can run this workflow as a shard invocation. The invocation is a durable record of the run. The stages below do not change.

- Start the workflow with `flint shard invoke task do_task --input task=<address>`.
- The mode comes from the Orbh session. In the headless mode, the invocation skips the step `close` at the open, because only a person confirms that close.
- Mark each step when it is done: `flint shard step done <step> --evidence "<…>"`. The steps are `pin`, `work`, `built`, `review`, and `close`. Outside an Orbh session, give `--invocation <id>` to `flint shard step`.
- In a headless session, the `done` close of the invocation prints the next command: `task review_task` on the task. Put it in the result.
- The behaviours only say lines: at the open, the pin command; at a `return --finish`, a check of the stage and the commits. The agent does each Ops write.
- Inside another open frame (for example a notepad), the task is a child frame, and the session continues after it. Then do not close the session, and in a headless session do not return: close the invocation with `--outcome done`, and the parent frame is the current frame again.
- When no invocation is open, follow the stages with no record.

# Input

- The address of the task (or its Convex id)
- (Optional) Instructions that help with the work

# Actions

## Stage 1: Pin

- Read the task: `ops task show <address> --json`. Read the type, the stage, the lineage, the task groups, the attachments, and the field `note`.
- Read the task note. Its file is `response.presences[0].path` of `flint resolve <note> --json`, or the note `(Task) <n> …` of the label `Task <n> · <Flint>`. A task with no note (from the web or Strike) gets one first: write its body to a temporary file, and run `flint shard task task-new --ops <address> --body-file <file>`.
- When the task is done, do not do it again. More work in a new scope is a continuation: [[dev-sk-task-continue_task]].
- When the note has no scope or no definition of done, scope it first: [[dev-wkfl-task-scope_task]], or ask the person.
- Pin the task before the first edit: `flint orbh task pin <address>` ([[dev-sk-task-pin_task]]). Check the `TASK` line with `flint orbh task show`.
- Set the status `doing` when it is `todo`: `ops task start <address>`. Then copy the state into the note: `flint shard task task-sync <address>`.
- Once the pin is set, progress to the next stage.

> [!headless]
> - Set `flint orbh session set phase reading-task`, and `progress "0/<N> checks"` (N is the count of items of the definition of done).

## Stage 2: Task Work

- Do the work until it is finished, or until you have done all that you can with no person.
- A step of the work that serves the intent of this task is a subtask in Strike (a Strike target mounted on this task). It is not a new task. Work that does not serve the intent is a new task: [[dev-sk-task-capture_as_task]] or [[dev-wkfl-task-create_task]].
- When an item of the definition of done is met, tick it in the task note. Write the meaningful steps in its `# Task Log`.
- **WIP commits** (for each task that changes a repository). Follow [[dev-knw-task-dev]] § The WIP Commit Rule:
  1. Work on the machine branch. Commit only your paths: `git commit -m "<subject>" -m "<body>" -- <path>...`.
  2. The subject is `[OR] wip: <Flint name>/Task <short id> <what changed>`. The hook adds `Task: <address>` from the pin.
  3. For a `task.dev`, record each commit after it: `ops task commit <address> <sha> --repo <name>`. For an untyped task, do not run `ops task commit`: an untyped task has no field `wipCommits`, so the command refuses with `task_untyped`. Name the commits in the result of the task.
  4. `git show --stat HEAD` must list only your paths.
- Work that changes code in a repository is usually a `task.dev`. When the task is untyped and the work changes code, retype it: `ops task retype <address> task.dev --json`, then set its repository (`ops task field <address> repo <name>` and `ops task relate <address> repo <name>`). Use the `address` of the output from then on. Do not make a new task for it. Do it before the first commit, so that `ops task commit` can record each commit. In an interactive session, tell the person first. Refresh the pin with `flint orbh task show`, and the note with `flint shard task task-sync <address>`.
- Keep a Mesh note of the work (a notepad, a report) with the task: `ops task attach <address> note "<Mesh path>"`.
- When a decision of a person blocks the work, write the blocker under `# Notes` in the task note, and tell the person. When the decision comes, continue.
- Once the work is complete and committed, progress to the next stage.

> [!headless]
> - Set `flint orbh session set phase implementing`, and update `progress` after each item.
> - When you are blocked, write the blocker under `# Notes` of the task note, set `phase blocked`, and use a deferred request: `flint orbh request "$ORBH_SESSION_ID" "<the question>"`. A subagent asks no person: it returns the blocker and the question to its dispatcher.

## Stage 3: Built

- Check each item of the definition of done against the work.
- Write the result: `ops task result <address> "<what the work gave, in two or three sentences>"`.
- For a `task.dev`: set the stage `built`: `ops task stage <address> built --note "<the commits and the tests>"`. Check that the field `wipCommits` (`task.fields.wipCommits` of `ops task show <address> --json`) lists each commit.
- For an untyped task: there is no stage. The result is the record: put each commit in it as `<sha> (<repo>)`.
- Copy the state into the note: `flint shard task task-sync <address>`. Add a last `# Task Log` line with the result.
- Once the result is written, progress to the next stage.

## Stage 4: Review Handoff

- Give the person a summary: what changed, the commits, the tests, and each item of the definition of done.
- The review comes next. A second session checks the work: [[dev-wkfl-task-review_task]] with `flint shard invoke task review_task --input task=<address>`. Do not review your own work, and never set `reviewed` on it.
- Converse to refine. When the person asks for a change, do it (Stage 2), set `built` again, and run `task-sync` again.
- When the person asks for the review now, give the review command, or dispatch the review to a second session when the person asks for it. Then skip the step `close`: `flint shard step skip close --reason 'toward review_task'`, and close the invocation with `--outcome done`.
- Once the person confirms the summary, progress to the next stage.

> [!headless]
> Do not wait for a person, and do not do Stage 5.
> - Set `flint orbh session set phase complete`.
> - With an open invocation, mark the step `review` done, and close the invocation: `flint shard invocations close --outcome done`. The close prints the `review_task` command.
> - When the close of the invocation prints `back in:`, a parent frame is open. Do not return: keep the result for the parent frame, and continue it.
> - Else return: `flint orbh session return --finish "Did task <address> <title>. <summary>. Commits: <shas>. Stage: built. Next: <the review_task command>."`

## Stage 5: Close

- A `task.dev` closes with `completed` only at `reviewed` or `verified`. When the stage is `built`, do not close: the review comes first. Leave the task open, and close the invocation.
- When the review has set `reviewed` (or the person has set `verified`), and the person confirms, close the task with [[dev-sk-task-close_task]]: `ops task close <address> --result "<result>"`, then `flint shard task task-sync <address>`.
- An untyped task: when the person confirms, close it with [[dev-sk-task-close_task]] (it runs `task-sync`).
- With an open invocation, close it with `--outcome done`.

> [!headless]
> A headless session does not do this stage. The invocation skips the step `close` at the open.

# Output

- The work is done, committed, and recorded on the task in Ops, and the task note shows the state
- A `task.dev` at `built` (or closed after the review and the confirm of the person)
- The summary to the person, or in the result
