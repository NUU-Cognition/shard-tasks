---
description: "A second session checks the work of a task against its task note: it writes a pass into the result, or the findings into the note"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start task` if you haven't already.

# Workflow: Review Task

Check the work of a task against its task note, in a session that did not do the work. A pass writes the verdict into the result. A fail writes the findings into the note. The review sets no stage: Ops has none. (A task with no note: read and write its body in place of the note.)

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

- The address of the task. Usually the task has a result from [[dev-wkfl-task-do_task]], with the commits and the session of the work.

# Actions

## Stage 1: Verify

- Read the task: `ops task show <address> --json`, and its task note (the field `note`; its file is `response.presences[0].path` of `flint resolve <note> --json`). Read the scope and the definition of done in the note, the result (`task.result`: the summary, the commits, and the session of the work), and the attachments.
- **A second session.** Find the session of the work in two places: the `Session:` part of the result, and the trailer `Orbh-Session` of each commit that the result names (`git log -1 --format='%(trailers:key=Orbh-Session,valueonly)' <sha>` in its repository). When one of them is this session (`$ORBH_SESSION_ID`), stop: a session does not review its own work. Tell the person (or return the refusal to the dispatcher).
- **No result.** When the task has no result, the work is not done yet. Tell the person, and ask whether to continue.
- Add the task as an object: `flint orbh objects add <address> --subscribe` ([[dev-sk-task-use_task]]).
- For each item of the definition of done:
  - Check that the work exists: the files, the code, and the commits that the result names (`git show --stat <sha>` in the repository of the `repo` link). Find a commit that the result does not name with `git log --grep "Task <short id>"`.
  - **Make contact with reality.** Run the build, the tests, or the commands when you can. Prefer a run to a read.
  - Record each item as passed or failed, with the evidence.
- Check that each commit lists only the paths of the task, and that its subject names the short id of the task.
- Give the person the findings: the items that passed, the items that failed (with the facts), and the items that are done but not ticked.
- Once the person has read the findings, progress to the next stage.

> [!headless]
> - At the start, set `flint orbh session set phase reviewing` and `progress "0/<N> checks"`. Update `progress` as you check.
> - Do not give the findings to a person. Keep them for the note and the result, and go on to Stage 2.

## Stage 2: Resolve

- When each item passed, skip to Stage 3.
- For each failed item:
  - When the fix is straightforward, fix it, check it again, and commit it with the WIP commit rule ([[dev-knw-task-commits]]). Name the commit in the verdict (Stage 3).
  - When the fix needs a decision or much work, flag it to the person.
- Once each item is resolved, or the person decides to leave the rest, progress to the next stage.

> [!headless]
> - Set `flint orbh session set phase resolving`.
> - For a decision that you cannot make, use a deferred request: `flint orbh request "$ORBH_SESSION_ID" "<the finding and the decision>"`. A subagent returns the finding and the question to its dispatcher.

## Stage 3: Verdict

- Tick each item that passed in the task note.
- **Pass** (each item passed, or was fixed): write the verdict into the result: `ops task result <address> "<the result>. Review passed: <evidence>. Review commits: <sha> (<repo>). Review session: $ORBH_SESSION_ID"`. Keep the text of the result of before, and add the verdict to it.
- **Fail** (an item is still open):
  - Write the findings under `## Review Findings` in the task note. Each finding has the item, the fact, and the next step.
  - Add the verdict to the result: `ops task result <address> "<the result>. Review found <n> open items: see Review Findings in the task note."`. Keep the text of the result of before.
- Do not close the task. A person closes it, or asks an agent to close it with [[dev-sk-task-close_task]].
- Copy the state into the note: `flint shard task task-sync <address>`. Add a `# Task Log` line with the verdict.
- With an open invocation, close it with `--outcome done`.

> [!headless]
> - When the close of the invocation prints `back in:`, a parent frame is open. Do not return: keep the result for the parent frame, and continue it.
> - Else set `flint orbh session set phase complete`, and return: `flint orbh session return --finish "Reviewed task <address>. <N items checked, M fixed>. Verdict: <passed | findings written>."`

# Output

- The verdict in the result (a pass, or the count of open items), and for a fail the findings in the task note; the note shows the state
