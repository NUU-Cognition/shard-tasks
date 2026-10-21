---
description: "Research the problem first, then write the scope into the task note (a new task through task-new, or the note of a task that exists), refine it with the person, and set scoped for a task.dev"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start task` if you haven't already.

# Workflow: Scope Task

Research a problem, then write a scope with a proposal into the task note of a task. This is a **planning** workflow, like [[dev-wkfl-task-create_task]], but the research comes first. Use it when the request is not clear, when the approach is not obvious, or when the person wants a proposal before the work.

> [!headless]
> In a headless or subagent Orbh session, no person is at the terminal. Do each stage, and follow the `> [!headless]` callout in it. Do not wait for a person.
> - Report progress with `flint orbh session set phase <phase>`.
> - End the turn with `flint orbh session return --finish "<result>"` only when no parent frame is open. When this workflow runs as a child frame of another workflow, continue the parent frame after the close (see the section `# Headless` of [[dev-init-task]]).

# Invocation

You can run this workflow as a shard invocation. The invocation is a durable record of the run. The stages below do not change.

- Start the workflow with `flint shard invoke task scope_task`. To scope a task that exists, give its address: `--input task=<address>`.
- When Stage 3 creates the task, set the input to its Ops address (the field `ops` of the output of `task-new`): `flint shard invocations set-input <id> task=<address>`.
- Mark each step when it is done: `flint shard step done <step> --evidence "<…>"`. The steps are `research`, `proposal`, `write`, `review`, and `finalise`. Outside an Orbh session, give `--invocation <id>` to `flint shard step`.
- After Stage 5, close the invocation: `flint shard invocations close <id> --outcome done`. The close prints the next command: `flint shard invoke task do_task --input task=<address>`.
- When no invocation is open, follow the stages with no record.

# Input

- A problem, an opportunity, or a request that is not clear
- (Optional) The address of a task that exists and needs a scope
- (Optional) Links to notes, code, or earlier conversations

# Actions

## Stage 1: Research

Research before you write. This stage is the value of Scope Task over Create Task.

- With a task that exists, read it first: `ops task show <address> --json` (the note, the lineage, the relations, and the attachments), and its task note. A task with no note keeps its content in its body.
- Search the Mesh for related notes (notepads, reports, plans, specs), and walk their links.
- Read the code and the files that the request touches.
- Search Ops for related tasks: `ops task search "<words>" --json`, `ops task hints --text "<title>"`.
- Record the earlier decisions, the approaches that failed, and the open questions.
- Keep the findings in your context. Do not write them yet.
- When the research finds a blocking ambiguity (the request can mean two very different things), ask the person before you continue.
- Once you have a coherent picture of the problem, progress to the next stage.

> [!headless]
> - Set `flint orbh session set phase reading-task`.
> - When the ambiguity blocks the scope, use a deferred request: `flint orbh request "$ORBH_SESSION_ID" "<the two readings and the question>"`. A subagent returns the question to its dispatcher.

## Stage 2: Draft Proposal

Write the proposal. It goes under `# Notes` of the task note, in paragraphs (not lists):

- **Background:** what you found in the Mesh, the code, and Ops.
- **Proposed approach:** the path that you recommend, with the reasons.
- **Alternatives considered:** the other paths, and why you did not choose them.
- **Open questions:** each item that the person must decide.
- **References:** the links, the paths, and the addresses that let the person check the reasons.

Then write the scope from the proposal: `# Context`, `# Task Description`, `# Task Requirements`, and `# Definition of Done` (checkboxes that a reviewer can check). See [[dev-knw-task-model]] § The Task Note.

Once the text of the note is complete, progress to the next stage.

## Stage 3: Scope Writing

- **A task that exists:** write the scope into its task note. A task with no note gets one first: write the text to a temporary file, and run `flint shard task task-new --ops <address> --body-file <file>`. A new title changes both parts: `flint helper rename "<old note title>" "<new title>"` and `ops task update <address> --title "<new title>"`. When the research shows that the task needs another type (for example an untyped task whose work changes code), retype it: `ops task retype <address> task.dev --json`, then set its repository (`ops task field <address> repo <name>` and `ops task relate <address> repo <name>`). Use the `address` of the output from then on. Do not make a new task for it. With an open invocation, set the input to the new address: `flint shard invocations set-input <id> task=<address>`.
- **No task:** write the text of the note to a temporary file, and create the task with `flint shard task task-new "<title>" [--type task.dev --repo <name>] [--org <org>] --body-file <file>`. Use the title of the proposed approach, not of the request. Keep the field `ops` of the output. When `ops` is `null`, the note exists and the Ops part failed: fix the cause, then run the command of `next`. Then place the Ops task with [[dev-sk-task-place_task]]. With an open invocation, set the input: `flint shard invocations set-input <id> task=<address>`.
- Attach the notes that the research made: `ops task attach <address> note "<Mesh path>"`.
- Do not pin the task: this workflow does not do its work.
- Once the scope is in the task note, give the task to the person, and progress to the next stage.

## Stage 4: Proposal Review

- Walk the person through the proposal: what you found, what you recommend, the alternatives, and the open questions.
- Converse to refine. Write each change into the task note.
- Once the person confirms the scope, progress to the next stage.

> [!headless]
> Do not converse with a person. Check the scope yourself. Keep each open question under `# Notes` of the note with your recommendation.

## Stage 5: Finalise

- Resolve each open question, or write that it waits for a later decision. No open question is left with no owner.
- For a `task.dev`: set the stage `scoped` when the note has the scope and the definition of done: `ops task stage <address> scoped --note "<one line about the scope>"`.
- Copy the state into the note: `flint shard task task-sync <address>`.
- Set the priority when the person gave one: `ops task update <address> --priority <low|medium|high|urgent>`.
- Give the person the address and the next command: `flint shard invoke task do_task --input task=<address>`.
- With an open invocation, close it with `--outcome done`.

> [!headless]
> - Close the invocation with `--outcome done` before the return.
> - When the close of the invocation prints `back in:`, a parent frame is open. Do not return: keep the result for the parent frame, and continue it.
> - Else set `flint orbh session set phase complete`, and return: `flint orbh session return --finish "Scoped task <address> <title>. <the proposal in two sentences>. Next: <the do_task command>."`

# Output

- A task note with the scope, the definition of done, and the proposal, linked to its Ops task
- A `task.dev` at `scoped`
