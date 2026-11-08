---
description: "Do an Ops task: add it as an object, do the work, make the WIP commits, write the result with the commits, ask for the review in Ops, give a summary, then hand it to a review"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start task` if you haven't already.

# Workflow: Do Task

Do the work of a task that exists in Ops, from the task object to the review. This is an **execution** workflow.

> [!headless]
> In a headless or subagent Orbh session, no person is at the terminal. Do each stage, and follow the `> [!headless]` callout in it. Do not wait for a person.
> - Report progress with `flint orbh session set phase <phase>` and `flint orbh session set progress "<done>/<total> checks"`. The phase values are in the section `# Headless` of [[dev-init-task]].
> - Never close a task that needs a person. The task stays open, with its result, for the review.
> - End the turn with `flint orbh session return --finish "<result>"` only when no parent frame is open. When this workflow runs as a child frame of another workflow, continue the parent frame after the close (see the section `# Headless` of [[dev-init-task]]).

# Invocation

You can run this workflow as a shard invocation. The invocation is a durable record of the run. The stages below do not change.

- Start the workflow with `flint shard invoke task do_task --input task=<address>`.
- The mode comes from the Orbh session. In the headless mode, the invocation skips the step `close` at the open, because only a person confirms that close.
- Mark each step when it is done: `flint shard step done <step> --evidence "<…>"`. The steps are `object`, `work`, `result`, `review`, and `close`. Outside an Orbh session, give `--invocation <id>` to `flint shard step`.
- In a headless session, the `done` close of the invocation prints the next command: `task review_task` on the task. Put it in the result.
- The behaviours only say lines: at the open, the add command of the task object; at a `return --finish`, a check of the result and the commits. The agent does each Ops write.
- Inside another open frame (for example a notepad), the task is a child frame, and the session continues after it. Then do not close the session, and in a headless session do not return: close the invocation with `--outcome done`, and the parent frame is the current frame again.
- When no invocation is open, follow the stages with no record.

# Input

- The address of the task (or its Convex id)
- (Optional) Instructions that help with the work

# Actions

## Stage 1: Task Object

- Read the task: `ops task show <address> --json`. Read the status, the result, the lineage, the task groups, the attachments, and the field `note`.
- Read the task note. Its file is `response.presences[0].path` of `flint resolve <note> --json`, or the note `(Task) <n> …` of the label `Task <n> · <Flint>`. A task with no note (from the web or Strike) gets one first: write its body to a temporary file, and run `flint shard task task-new --ops <address> --body-file <file>`.
- When the task is done, do not do it again. More work in a new scope is a continuation: [[dev-sk-task-continue_task]].
- When the note has no scope or no definition of done, scope it first: [[dev-wkfl-task-scope_task]], or ask the person.
- Add the task as an object before the first edit: `flint orbh objects add <address> --subscribe` ([[dev-sk-task-use_task]]). Check the item with `flint orbh objects list`. The Page shows it in the `OBJECTS` block.
- Set the status `doing` when it is `todo`: `ops task start <address>`. Then copy the state into the note: `flint shard task task-sync <address>`.
- Once the task is an object of the session, progress to the next stage.

> [!headless]
> - Set `flint orbh session set phase reading-task`, and `progress "0/<N> checks"` (N is the count of items of the definition of done).

## Stage 2: Task Work

- Do the work until it is finished, or until you have done all that you can with no person.
- A step of the work that serves the intent of this task is a subtask in Strike (a Strike target mounted on this task). It is not a new task. Work that does not serve the intent is a new task: [[dev-sk-task-capture_as_task]] or [[dev-wkfl-task-create_task]].
- When an item of the definition of done is met, tick it in the task note. Write the meaningful steps in its `# Task Log`.
- **WIP commits** (for each task that changes a repository). Follow [[dev-knw-task-commits]] § The WIP Commit Rule:
  1. Work on the machine branch. Commit only your paths: `git commit -m "<subject>" -m "<body>" -- <path>...`.
  2. The subject is `[OR] wip: <Flint name>/Task <short id> <what changed>`. The hook adds the trailers `Orbh-Fleet` and `Orbh-Session`.
  3. Keep each commit as `<sha> (<repo>)`: Stage 3 names each commit in the result of the task.
  4. `git show --stat HEAD` must list only your paths.
- When the work changes code in a repository and the task has no `repo` link (the `relations` of `ops task show <address> --json`), add it: `ops task relate <address> repo <name>`.
- Keep a Mesh note of the work (a notepad, a report) with the task: `ops task attach <address> note "<Mesh path>"`.
- When a decision of a person blocks the work, write the blocker under `# Notes` in the task note, and tell the person. When the decision comes, continue.
- Once the work is complete and committed, progress to the next stage.

> [!headless]
> - Set `flint orbh session set phase implementing`, and update `progress` after each item.
> - When you are blocked, write the blocker under `# Notes` of the task note, set `phase blocked`, and use a deferred request: `flint orbh request "$ORBH_SESSION_ID" "<the question>"`. A subagent asks no person: it returns the blocker and the question to its dispatcher.

## Stage 3: Result

- Check each item of the definition of done against the work.
- Write the result. It is the record of the work: what the work gave, the tests, each commit as `<sha> (<repo>)`, and the session ([[dev-knw-task-commits]]):
  ```bash
  ops task result <address> "<what the work gave, in two or three sentences>. Tests: <…>. Commits: <sha> (<repo>), …. Session: $ORBH_SESSION_ID"
  ```
- Check the result: `task.result` of `ops task show <address> --json` names each commit.
- Copy the state into the note: `flint shard task task-sync <address>`. Add a last `# Task Log` line with the result.
- **Ask for the review in Ops.** Each finished task gets exactly one review request, after its result and before any close. The work is finished when each item of the definition of done is met. Do not wait for the person to ask for it:
  ```bash
  ops task review request <address> --note "<the summary, the commits, and what to check>" --json
  ```
  - With no `--to`, the reviewer is the owner of the task. The request goes into **Your Reviews** of the web app, with a notification. Give `--to <member>` when the person names another reviewer.
  - A task of a team with no owner refuses with `review_no_reviewer`. Then run the command again with `--to me`. `me` is the operator, because `ops` runs with the sign-in of the operator. Do not guess another reviewer.
  - Record `itemId` and `reviewerUserId` of the output. Add a `# Task Log` line with the reviewer and the `itemId`.
  - The request loops the reviewer into the task (unless the reviewer is the owner), so the reviewer hears every comment on it. The reviewer approves the work there (this closes the task), or asks for changes.
  - After a change of the result (Stage 4), run the same command again. To the same reviewer, it changes the note of the open request (`again: true`) and makes no second request.
  - When the request fails for another reason, record the error code and the review command, and tell the person. Do not close the task until a request is recorded.
- **A task that is not finished gets no request.** When the work is blocked or not complete, do not ask for a review. Write the blocker under `# Notes` of the task note, and report the task with its blocker.
- Once the result is written and the request is recorded (or the blocker is reported), progress to the next stage.

> [!headless]
> - Ask for the review with no person: the command above, with `--json`. On `review_no_reviewer`, run it again with `--to me`. Keep `itemId` and `reviewerUserId` for the result. On another error, put the error code and the review command in the result.
> - A blocked or unfinished task gets no request: set `flint orbh session set phase blocked`, and put the blocker in the result.

## Stage 4: Review Handoff

- Give the person a summary: what changed, the commits, the tests, and each item of the definition of done.
- The review comes next. A second session checks the work: [[dev-wkfl-task-review_task]] with `flint shard invoke task review_task --input task=<address>`. Do not review your own work.
- Name the review request of Stage 3 in the summary: the reviewer and the `itemId`. For a task that is not finished, name the blocker: it has no request.
- Converse to refine. When the person asks for a change, do it (Stage 2), write the result again with each commit (Stage 3), run `task-sync` again, and run the review request again (the same reviewer: `again: true`, no second request).
- When the person asks for the review now, give the review command, or dispatch the review to a second session when the person asks for it. Then skip the step `close`: `flint shard step skip close --reason 'toward review_task'`, and close the invocation with `--outcome done`.
- Once the person confirms the summary, progress to the next stage.

> [!headless]
> Do not wait for a person, and do not do Stage 5.
> - Do not ask for the review again: Stage 3 recorded the request. Put the reviewer and the `itemId` (or the blocker) in the result.
> - Set `flint orbh session set phase complete`.
> - With an open invocation, mark the step `review` done, and close the invocation: `flint shard invocations close --outcome done`. The close prints the `review_task` command.
> - When the close of the invocation prints `back in:`, a parent frame is open. Do not return: keep the result for the parent frame, and continue it.
> - Else return: `flint orbh session return --finish "Did task <address> <title>. <summary>. Commits: <shas>. Status: doing, with the result. Review: requested of <reviewer> (<itemId>), or <the error code and the review command>, or not requested: <the blocker>. Next: <the review_task command>."`

## Stage 5: Close

- Close only a task whose review request is recorded (Stage 3). When the person confirms, close the task with [[dev-sk-task-close_task]]: `ops task close <address>`, then `flint shard task task-sync <address>`. Keep the result of Stage 3: it names the commits. A close cancels the open review requests of the task (`task_closed`).
- When the person wants the review first, do not close: leave the task open for the review, and close the invocation.
- With an open invocation, close it with `--outcome done`.

> [!headless]
> A headless session does not do this stage. The invocation skips the step `close` at the open.

# Output

- The work is done, committed, and recorded on the task in Ops, and the task note shows the state
- The task open with its result and an open review request in Ops (or closed after the confirm of the person)
- The summary to the person, or in the result
