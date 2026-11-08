---
description: "Make or take a task group, add each of its tasks to the session as an object, and do each task in it; each task is recorded, sent to review in Ops, and closed alone"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start task` if you haven't already.

# Workflow: Do Task Group

Do a set of tasks together in one session, through a task group. Each task stays a full task: it gets its own commits, its own result, and its own close.

> [!headless]
> In a headless or subagent Orbh session, no person is at the terminal. Do each stage, and follow the `> [!headless]` callout in it. Do not wait for a person.
> - Report progress with `flint orbh session set phase <phase>` and `flint orbh session set progress "<done>/<total> tasks"`.
> - Never close a task that needs a person. Each task stays open, with its result, for the review.
> - End the turn with `flint orbh session return --finish "<result>"` only when no parent frame is open. When this workflow runs as a child frame of another workflow, continue the parent frame after the close (see the section `# Headless` of [[dev-init-task]]).

# Invocation

You can run this workflow as a shard invocation. The invocation is a durable record of the run. The stages below do not change.

- Start the workflow with `flint shard invoke task do_task_group --input task=<task group address>`. The input `task` holds the address of the task group (`@v1/<org>/taskgroup/<id>#ops`).
- To make a new task group, give no input. After Stage 1, set the input: `flint shard invocations set-input <id> task=<task group address>`.
- Mark each step when it is done: `flint shard step done <step> --evidence "<…>"`. The steps are `group`, `objects`, `work`, and `summary`. Outside an Orbh session, give `--invocation <id>` to `flint shard step`.
- After Stage 4, close the invocation: `flint shard invocations close <id> --outcome done`.
- When no invocation is open, follow the stages with no record.

# Input

- The address of a task group, or the tasks to do together (their addresses, or the context of new tasks)
- (Optional) The title of a new task group

# Actions

## Stage 1: Task Group

- **A task group that exists:** read it: `ops task group show <group> --json`. Read the tasks, `open`, and the attachments.
- **A new task group:** check the shape first. Tasks with one intent are one task (a merge: [[dev-sk-task-merge_tasks]]). Tasks in an order are a chain ([[dev-sk-task-chain_tasks]]). Then make the task group with [[dev-sk-task-group_tasks]]: `ops task group create "<title>" --task <ref> [--task <ref> ...] --json`. Create each task that does not exist first with `task-new` ([[dev-wkfl-task-create_task]], Stages 1 and 2), and place each one alone.
- Read each task: `ops task show <ref> --json`. A task with no scope gets a scope first. A done task stays out of the work.
- Choose the order of the work. A task in a chain waits until it is ready (`task.chainReady` of `ops task show <ref> --json`).
- With an open invocation and a new task group, set the input: `flint shard invocations set-input <id> task=<task group address>`.
- Once the task group and its order are clear, progress to the next stage.

> [!headless]
> - Set `flint orbh session set phase reading-task`, and `progress "0/<N> tasks"`.

## Stage 2: Task Objects

- Add each task of the task group as an object: `flint orbh objects add <task address> --subscribe` for each task ([[dev-sk-task-use_task]]). Do not add the task group: its object does not resolve.
- A session holds at most 20 items. When the task group has more tasks, add the first tasks of the order. Remove a task when it is done (`flint orbh objects remove <id>`), and add the next task.
- Check the items: `flint orbh objects list`. The Page shows each task in the `OBJECTS` block.
- Set each task that you start to `doing`: `ops task start <ref>`, then `flint shard task task-sync <ref>`.
- Once the tasks are objects of the session, progress to the next stage.

## Stage 3: Each Task

Do the tasks one at a time, in the order of Stage 1. For each task:

1. Do the work. A step that serves the intent of this task is a subtask in Strike. Work for another task of the task group goes to that task.
2. **WIP commits.** One commit holds the work of one task only. Follow [[dev-knw-task-commits]] § The WIP Commit Rule, with the short id of this task in the subject. Keep each commit of this task as `<sha> (<repo>)` for its result (step 4).
3. Tick the items of the definition of done in the task note of this task (a task with no note: give it one with `flint shard task task-new --ops <ref>`).
4. Write the result of this task, with each of its commits and the session: `ops task result <ref> "<text>. Commits: <sha> (<repo>), …. Session: $ORBH_SESSION_ID"`. Name only the commits of this task.
5. Copy the state into the note: `flint shard task task-sync <ref>`.
6. **Ask for the review of this task in Ops**, right after its result and its sync, and before its close. Each finished task gets exactly one request. The work of a task is finished when each item of its definition of done is met. Do not wait for the person to ask for it:
   ```bash
   ops task review request <ref> --note "<the summary of this task, its commits, and what to check>" --json
   ```
   Name only the commits of this task in the note. With no `--to`, the reviewer is the owner of the task. Give `--to <member>` when the person names another reviewer. A task of a team with no owner refuses with `review_no_reviewer`: then run the command again with `--to me` (`me` is the operator, because `ops` runs with the sign-in of the operator). Do not guess another reviewer. Record the `itemId` and the reviewer of this task, and add a `# Task Log` line with them. When the request fails for another reason, record the error code and the review command. After a change of the result, run the same command again: to the same reviewer it changes the note of the open request (`again: true`) and makes no second request.
   **A task that is not finished gets no request.** When its work is blocked or not complete, write the blocker under `# Notes` in its task note, and keep the blocker for the summary.
7. **Close this task alone** only after its review request is recorded, when the person confirms ([[dev-sk-task-close_task]], which runs `task-sync`). A close cancels the open requests of the task (`task_closed`). In a headless session, or when the person wants the review first, leave it open for its review.
8. When a task becomes too big for this session, remove it from the task group (`ops task group remove <group> <ref>`), and tell the person. It needs its own session.

Once each task has its result and its recorded review request, or its blocker, or is closed or removed, progress to the next stage.

> [!headless]
> - Set `flint orbh session set phase implementing`, and update `progress` after each task.
> - Ask for the review of each finished task with no person, right after its result and its sync (step 6, with `--json`). Keep the `itemId` and the reviewer of each one for the result.
> - When a task is blocked, write the blocker under `# Notes` in its task note, ask for no review of it, and go on to the next task. Ask with a deferred request only when no task can continue. A subagent returns the blocker to its dispatcher.

## Stage 4: Summary and Review Handoff

- Give the person a summary for each task: the address, what changed, the commits, the status, the review request (the reviewer and the `itemId` of Stage 3) or the blocker, and the close or the next step.
- Each task that is still open needs a review in a second session: `flint shard invoke task review_task --input task=<address>`, one for each task. Give the commands.
- Report the review requests that Stage 3 recorded: one for each finished task. Do not ask again. A task that is not finished has no request: report it with its blocker. Do not ask for a review of the task group: a request takes one task.
- The task group stays open while one of its tasks is open. Do not delete it.
- Converse to refine. When the person confirms the summary, close the invocation with `--outcome done`.

> [!headless]
> - Do not ask for a review here: Stage 3 asked for each finished task. Put the reviewer and the `itemId` of each finished task, and the blocker of each other task, in the result.
> - Set `flint orbh session set phase complete`.
> - Close the invocation with `--outcome done`.
> - When the close of the invocation prints `back in:`, a parent frame is open. Do not return: keep the result for the parent frame, and continue it.
> - Else return: `flint orbh session return --finish "Did task group <address> <title>: <n> tasks. <one line for each task: address, status, commits, and the review request (<reviewer>, <itemId>) or the error code, or the blocker>. Next: <the review_task command of each open task>."`

# Output

- A task group whose tasks are objects of the session, with each task done alone: its commits, its result, and its close
- One review request in Ops for each finished task (its `itemId`), the blocker of each task that is not finished, and the review command of each open task
