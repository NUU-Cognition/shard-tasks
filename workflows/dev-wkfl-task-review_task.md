---
description: "A second session checks the work of a task against its task note: it sets reviewed for a task.dev when the work passes, or writes the findings into the note"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start task` if you haven't already.

# Workflow: Review Task

Check the work of a task against its task note, in a session that did not do the work. A pass sets `reviewed` on a `task.dev`. A fail writes the findings into the note. (A task with no note: read and write its body in place of the note.)

> [!headless]
> In a headless or subagent Orbh session, no person is at the terminal. Do each stage, and follow the `> [!headless]` callout in it. Fix the straightforward findings, and give the verdict. Ask only for a decision that you cannot make.
> - Report progress with `flint orbh session set phase <phase>` and `flint orbh session set progress "<checked>/<total> checks"`.
> - End the turn with `flint orbh session return --finish "<result>"` only when no parent frame is open. When this workflow runs as a child frame of another workflow, continue the parent frame after the close (see the section `# Headless` of [[dev-init-task]]).

# Invocation

You can run this workflow as a shard invocation. The invocation is a durable record of the review. The stages below do not change.

- Start the workflow with `flint shard invoke task review_task --input task=<address>`.
- Mark each step when it is done: `flint shard step done <step> --evidence "<…>"`. The steps are `verify`, `resolve`, and `verdict`. Outside an Orbh session, give `--invocation <id>` to `flint shard step`.
- After Stage 3, close the invocation: `flint shard invocations close <id> --outcome done`.
- When no invocation is open, follow the stages with no record.

# Input

- The address of the task. For a `task.dev`, the stage is usually `built`.

# Actions

## Stage 1: Verify

- Read the task: `ops task show <address> --json`, and its task note (the field `note`; its file is `response.presences[0].path` of `flint resolve <note> --json`). Read the scope and the definition of done in the note, the result, the field `wipCommits`, the stage events (`stageEvents`, oldest first), and the attachments.
- **A second session.** Check the stage events. When the `session` of the last event with `to: "built"` is this session (`$ORBH_SESSION_ID`), stop: a session does not review its own work. Tell the person (or return the refusal to the dispatcher).
- **The stage.** For a `task.dev` with no `built` stage, tell the person that the work is not built yet, and ask whether to continue.
- Pin the task: `flint orbh task pin <address>`. The pin records the review session on the task.
- For each item of the definition of done:
  - Check that the work exists: the files, the code, the commits in `wipCommits` (`git show --stat <sha>` in the repository of the field `repo`).
  - **Make contact with reality.** Run the build, the tests, or the commands when you can. Prefer a run to a read.
  - Record each item as passed or failed, with the evidence.
- Check that each commit lists only the paths of the task, and that it has the trailer `Task: <address>` when the work session had a pin.
- Give the person the findings: the items that passed, the items that failed (with the facts), and the items that are done but not ticked.
- Once the person has read the findings, progress to the next stage.

> [!headless]
> - At the start, set `flint orbh session set phase reviewing` and `progress "0/<N> checks"`. Update `progress` as you check.
> - Do not give the findings to a person. Keep them for the note and the result, and go on to Stage 2.

## Stage 2: Resolve

- When each item passed, skip to Stage 3.
- For each failed item:
  - When the fix is straightforward, fix it, check it again, and commit it with the WIP commit rule ([[dev-knw-task-dev]]). For a `task.dev`, record the commit: `ops task commit <address> <sha> --repo <name>`. For an untyped task, name the commit in the verdict (Stage 3).
  - When the fix needs a decision or much work, flag it to the person.
- Once each item is resolved, or the person decides to leave the rest, progress to the next stage.

> [!headless]
> - Set `flint orbh session set phase resolving`.
> - For a decision that you cannot make, use a deferred request: `flint orbh request "$ORBH_SESSION_ID" "<the finding and the decision>"`. A subagent returns the finding and the question to its dispatcher.

## Stage 3: Verdict

- Tick each item that passed in the task note.
- **Pass** (each item passed, or was fixed):
  - `task.dev`: set `ops task stage <address> reviewed --note "<the verdict and the evidence in one line>"`.
  - Untyped task: write the verdict into the result: `ops task result <address> "<the result>. Review passed: <evidence>. Review commits: <sha> (<repo>)"`. Keep the text of the result of before, and add the verdict to it.
- **Fail** (an item is still open):
  - Write the findings under `## Review Findings` in the task note. Each finding has the item, the fact, and the next step.
  - Do not set `reviewed`. For a `task.dev`, the stage stays `built`.
- Never set `verified`: only a person sets it.
- Do not close the task. A person closes it, or asks an agent to close it with [[dev-sk-task-close_task]]: a `task.dev` can close at `reviewed`, or after the verify of a person.
- Copy the state into the note: `flint shard task task-sync <address>`. Add a `# Task Log` line with the verdict.
- With an open invocation, close it with `--outcome done`.

> [!headless]
> - When the close of the invocation prints `back in:`, a parent frame is open. Do not return: keep the result for the parent frame, and continue it.
> - Else set `flint orbh session set phase complete`, and return: `flint orbh session return --finish "Reviewed task <address>. <N items checked, M fixed>. Verdict: <reviewed | findings written>."`

# Output

- A `task.dev` at `reviewed`, or the findings in the task note; the note shows the state
- The review session attached to the task
