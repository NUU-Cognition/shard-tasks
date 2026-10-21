---
description: "Create a task with task-new (a task note and an Ops task), place it, pin it, and do it in one run: the work, the WIP commits, built, a summary, then the review"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start task` if you haven't already.

# Workflow: Create and Do Task

Create a task and do it at once, in one run. This is an **execution** workflow: there is no separate planning phase. `task-new` makes the two parts of the task: the task note (the content) and the Ops task (the state). Each state write goes to Ops, and `task-sync` copies it into the note.

> [!headless]
> In a headless or subagent Orbh session, no person is at the terminal. Do each stage, and follow the `> [!headless]` callout in it. Do not wait for a person.
> - Report progress with `flint orbh session set phase <phase>` and `flint orbh session set progress "<done>/<total> checks"`. The phase values are in the section `# Headless` of [[dev-init-task]].
> - Never close a task that needs a person. A `task.dev` stays at `built` for the review.
> - End the turn with `flint orbh session return --finish "<result>"` only when no parent frame is open. When this workflow runs as a child frame of another workflow, continue the parent frame after the close (see the section `# Headless` of [[dev-init-task]]).

# Invocation

You can run this workflow as a shard invocation. The invocation is a durable record of the run. The stages below do not change.

- Start the workflow with `flint shard invoke task create_and_do_task`. The task does not exist yet, so give no input.
- After Stage 1, set the input to the address of the new task: `flint shard invocations set-input <id> task=<address>`. The hint after each write prints the command with the id.
- The mode comes from the Orbh session. In the headless mode, the invocation skips the step `close` at the open.
- Mark each step when it is done: `flint shard step done <step> --evidence "<…>"`. The steps are `create`, `work`, `built`, `review`, and `close`. Outside an Orbh session, give `--invocation <id>` to `flint shard step`.
- In a headless session, the `done` close of the invocation prints the next command: `task review_task` on the task. Put it in the result.
- Inside another open frame (for example a notepad), the task is a child frame, and the session continues after it. Then do not close the session, and in a headless session do not return: close the invocation with `--outcome done`, and the parent frame is the current frame again.
- When no invocation is open, follow the stages with no record.

# Input

- The context of the work
- (Optional) Instructions that help with the work
- (Optional) A place, a type, or a task group that the person gives

# Actions

## Stage 1: Task Creation

- Look before you create. When the pinned task of the session has this intent, the work is a subtask of it: do not create a task, and use [[dev-wkfl-task-do_task]] on the pinned task. When another open task has this intent (`ops task search "<words of the title>" --json`, `ops task hints --text "<title>"`), use [[dev-wkfl-task-do_task]] on it.
- Choose a concrete title and the type: `task.dev` (with `--repo <name>`) for work that changes code in a repository, else no type. When the type turns out wrong later, change it with `ops task retype <address> <type>` (or `--none`), and use the `address` of its output. Do not make a new task for it.
- Write the body of the task note to a temporary file outside the Mesh: `# Context`, `# Task Description`, `# Task Requirements`, `# Definition of Done`, `# Task Log`, and `# Notes`, with no frontmatter. See [[dev-knw-task-model]] § The Task Note.
- Create the task (the Ops task is unplaced):
  ```bash
  flint shard task task-new "<title>" [--type task.dev --repo <name>] [--org <org>] --body-file <file>
  ```
- Keep the `ops` (the Ops address, `<address>` below) and the `path` (the note) of the output. When `ops` is `null`, the note exists and the Ops part failed: fix the cause, then run the command of `next`. Never run `task-new` again for the same task.
- Place it with [[dev-sk-task-place_task]]. When the person gave a task group, add the task to it: `ops task group add <group> <address>`.
- For a `task.dev` with a complete scope, set the stage: `ops task stage <address> scoped`.
- Pin it: `flint orbh task pin <address>`. Set the status `doing`: `ops task start <address>`. Then copy the state into the note: `flint shard task task-sync <address>`.
- With an open invocation, set the input: `flint shard invocations set-input <id> task=<address>`.
- Once the task is pinned, progress to the next stage.

> [!headless]
> - Set `flint orbh session set phase creating-task`.
> - The context, the type, and the place come from the prompt, not from a person.

## Stage 2: Task Work

- Do the work until it is finished, or until you have done all that you can with no person.
- A step of the work that serves the intent of this task is a subtask in Strike, not a new task.
- When an item of the definition of done is met, tick it in the task note. Write the meaningful steps in its `# Task Log`.
- **WIP commits.** Follow [[dev-knw-task-dev]] § The WIP Commit Rule: the machine branch, only your paths, and the subject `[OR] wip: <Flint name>/Task <short id> <what changed>`. The hook adds `Task: <address>` from the pin. For a `task.dev`, record each commit after it: `ops task commit <address> <sha> --repo <name>`. For an untyped task, do not run `ops task commit`: an untyped task has no field `wipCommits`, so the command refuses with `task_untyped`. Name the commits in the result of the task.
- Attach a Mesh note of the work when one exists: `ops task attach <address> note "<Mesh path>"`.
- When a decision of a person blocks the work, write the blocker under `# Notes` in the task note, and tell the person.
- Once the work is complete and committed, progress to the next stage.

> [!headless]
> - Set `flint orbh session set phase implementing`, and update `progress` after each item.
> - When you are blocked, write the blocker under `# Notes` of the task note, set `phase blocked`, and use a deferred request: `flint orbh request "$ORBH_SESSION_ID" "<the question>"`. A subagent returns the blocker and the question to its dispatcher.

## Stage 3: Built

- Check each item of the definition of done against the work.
- Write the result: `ops task result <address> "<what the work gave, in two or three sentences>"`. For an untyped task, put each commit in it as `<sha> (<repo>)`.
- For a `task.dev`: set `ops task stage <address> built --note "<the commits and the tests>"`, and check that the field `wipCommits` (`task.fields.wipCommits` of `ops task show <address> --json`) lists each commit.
- Copy the state into the note: `flint shard task task-sync <address>`. Add a last `# Task Log` line with the result.
- Once the result is written, progress to the next stage.

## Stage 4: Review Handoff

- Give the person a summary: what changed, the commits, the tests, and each item of the definition of done.
- The review comes next, in a second session: [[dev-wkfl-task-review_task]] with `flint shard invoke task review_task --input task=<address>`. Do not review your own work, and never set `reviewed` on it.
- Converse to refine. When the person asks for a change, do it (Stage 2), set `built` again, and run `task-sync` again.
- When the person asks for the review now, skip the step `close` (`flint shard step skip close --reason 'toward review_task'`), and close the invocation with `--outcome done`.
- Once the person confirms the summary, progress to the next stage.

> [!headless]
> Do not wait for a person, and do not do Stage 5.
> - Set `flint orbh session set phase complete`.
> - With an open invocation, mark the step `review` done, and close the invocation: `flint shard invocations close --outcome done`. The close prints the `review_task` command.
> - When the close of the invocation prints `back in:`, a parent frame is open. Do not return: keep the result for the parent frame, and continue it.
> - Else return: `flint orbh session return --finish "Created and did task <address> <title>. <place>. <summary>. Commits: <shas>. Stage: built. Next: <the review_task command>."`

## Stage 5: Close

- A `task.dev` closes with `completed` only at `reviewed` or `verified`. At `built`, do not close: leave the task open for the review, and close the invocation.
- When the review has set `reviewed` (or the person has set `verified`), and the person confirms, close the task with [[dev-sk-task-close_task]] (it runs `task-sync`).
- An untyped task: when the person confirms, close it with [[dev-sk-task-close_task]].
- With an open invocation, close it with `--outcome done`.

> [!headless]
> A headless session does not do this stage. The invocation skips the step `close` at the open.

# Output

- A new task note and Ops task, linked both ways, placed, pinned, with the work, the commits, and the result; the note shows the state
- A `task.dev` at `built` (or closed after the review and the confirm of the person)
