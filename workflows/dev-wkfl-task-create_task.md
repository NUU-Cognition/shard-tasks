---
description: "Make a todo task for later work with task-new (a task note and an Ops task, linked both ways), place it with the hint rule, refine it with the person, and set scoped for a task.dev"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start task` if you haven't already.

# Workflow: Create Task

Make a task for later work, place it, and scope it. The task has two parts: a task note in the Flint (the content) and an Ops task (the state). This is a **planning** workflow: it does not do the work of the task.

> [!headless]
> In a headless or subagent Orbh session, no person is at the terminal. Do each stage, and follow the `> [!headless]` callout in it. Do not wait for a person.
> - Report progress with `flint orbh session set phase <phase>`. The phase values are in the section `# Headless` of [[dev-init-task]].
> - End the turn with `flint orbh session return --finish "<result>"` only when no parent frame is open. When this workflow runs as a child frame of another workflow, continue the parent frame after the close (see the section `# Headless` of [[dev-init-task]]).

# Invocation

You can run this workflow as a shard invocation. The invocation is a durable record of the run. The stages below do not change.

- Start the workflow with `flint shard invoke task create_task`. The task does not exist yet, so give no input.
- After Stage 1, set the input to the Ops address of the new task (the field `ops` of the output of `task-new`): `flint shard invocations set-input <id> task=<address>`. The hint after each write prints the command with the id.
- Mark each step when it is done: `flint shard step done <step> --evidence "<…>"`. The steps are `create`, `place`, `review`, and `finalise`. Outside an Orbh session, give `--invocation <id>` to `flint shard step`.
- After Stage 4, close the invocation: `flint shard invocations close <id> --outcome done`. The close prints the next command: `flint shard invoke task do_task --input task=<address>`.
- When no invocation is open, follow the stages with no record.

# Input

- The context of the work: what must change, and why
- (Optional) The type: `task.dev` for work that changes code in a repository, with the repository name
- (Optional) A place, a priority, or a task group that the person gives

# Actions

## Stage 1: Task Creation

- Look before you create. Find an open task with the same intent: `ops task search "<words of the title>" --json` (check the status of each match), and `ops task hints --text "<title>"`. When one exists, do not create a second task: give its address to the person, and stop.
- Choose a concrete title that says what the task will do.
- Choose the type. Use `task.dev` (with `--repo <name>`) for work that changes code in a repository. Else use no type. When a task that exists has the wrong type, do not create a second task: change its type with `ops task retype <address> <type>` (or `--none`).
- Write the body of the task note to a temporary file outside the Mesh: the sections `# Context`, `# Task Description`, `# Task Requirements`, `# Definition of Done` (checkboxes that a reviewer can check), `# Task Log`, and `# Notes` of the template `tmp-proj-task-v0.2`, with no frontmatter. See [[dev-knw-task-model]] § The Task Note.
- Create the task with `task-new`. It writes the note, makes the Ops task with no body (unplaced: Stage 2 places it), and links both:
  ```bash
  flint shard task task-new "<title>" [--type task.dev --repo <name>] [--org <org>] --body-file <file>
  ```
- Keep the `ops` (the Ops address) and the `path` (the note) of the output. When the output has `ops: null`, the note exists and the Ops part failed: fix the cause, then run the command of `next` (`task-link`). Never run `task-new` again for the same task.
- With an open invocation, set the input: `flint shard invocations set-input <id> task=<ops address>`.
- Do not pin the new task: this workflow does not do its work. The pin of the session does not change.
- Once the note and the Ops task exist, progress to the next stage.

> [!headless]
> - Set `flint orbh session set phase creating-task`.
> - The context, the type, and the place come from the prompt, not from a person.

## Stage 2: Placement

- Place the task with [[dev-sk-task-place_task]]: a place that the person gave wins; else one clear hint sets the home, two or more hints add a `related` link each, and no hint leaves the task unplaced.
- When the person gave a task group, add the task to it: `ops task group add <group> <address>`.
- Once the place is set (or the task stays unplaced by the rule), progress to the next stage.

## Stage 3: Task Review

- Give the person the title, the type, the place, and the task note.
- Converse to refine the task. Write each change of the content into the task note. A new title changes both parts: `flint helper rename "<old note title>" "<new title>"` and `ops task update <address> --title "<new title>"`. When the type must change, use `ops task retype <address> <type>` (or `--none`), use the `address` of its output from then on, and run `flint shard task task-sync <address>`. A new type keeps only the stage and the fields that it defines.
- Once the person confirms the task, progress to the next stage.

> [!headless]
> Do not converse with a person. Check the task note yourself: it must read as a complete task that a session can do. When the request is not clear and you cannot find a reasonable scope:
> 1. Write the best note that you can, and put the open questions under `# Notes`.
> 2. Set `phase blocked`, and use a deferred request: `flint orbh request "$ORBH_SESSION_ID" "<what you need to finish the scope>"`. A subagent asks no person: it returns the question to its dispatcher.

## Stage 4: Finalise

- Set the priority when the person gave one: `ops task update <address> --priority <low|medium|high|urgent>`.
- For a `task.dev`: when the note has the scope and the definition of done, set the stage: `ops task stage <address> scoped --note "<one line about the scope>"`. When the scope is not complete, do not set `scoped`.
- Copy the state into the note: `flint shard task task-sync <address>`.
- Give the person the address and the next command: `flint shard invoke task do_task --input task=<address>`.
- With an open invocation, close it with `--outcome done`.

> [!headless]
> - Close the invocation with `--outcome done` before the return.
> - When the close of the invocation prints `back in:`, a parent frame is open. Do not return: keep the result for the parent frame, and continue it.
> - Else set `flint orbh session set phase complete`, and return: `flint orbh session return --finish "Created task <address> <title>. <place>. <stage>. Next: <the do_task command>."`

# Output

- A task note in `Mesh/Types/Tasks/` and a `todo` Ops task with its place, linked both ways
- A `task.dev` at `scoped` when its scope is complete
