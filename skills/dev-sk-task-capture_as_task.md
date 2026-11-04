---
description: "Record work that the session already did as an Ops task: create it, place it, add it as an object, record the commits, and close it or leave it for review"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start task` if you haven't already.

# Skill: Capture As Task

Record the recent work of the session as a task in Ops, when the work started with no task object.

# Input

- The work that the session did: the changes, the commits, and the result
- (Optional) A title or a place that the person gives

# Actions

1. **Check for a task first.** When an open task already has this intent, do not create a task: add it as an object ([[dev-sk-task-use_task]]), and record the work on it. Use `ops task search "<words of the title>" --json` and `ops task hints --text "<title>"` to find it.
2. **A repository.** When the work changed code in a repository, the task gets a `repo` link: give `--repo <name>` to `task-new` in step 3. A task that step 1 found does not need steps 3 to 5: add the link to it (`ops task relate <address> repo <name>`), and go to step 6.
3. **Create the task.** Write the body of the task note to a temporary file outside the Mesh: `# Context`, `# Task Description`, `# Task Requirements`, `# Definition of Done` (ticked, as the work was done), `# Task Log`, and `# Notes`, with no frontmatter (see [[dev-knw-task-model]] § The Task Note). Then create the task with its note:
   ```bash
   flint shard task task-new "<title>" [--repo <name>] [--org <org>] --body-file <file>
   ```
   Keep the field `ops` of the output (the Ops address, `<address>` below). When `ops` is `null`, the note exists and the Ops part failed: fix the cause, then run the command of `next`. Never run `task-new` again for the same work.
4. **Place it** with [[dev-sk-task-place_task]].
5. **Add it as an object**: `flint orbh objects add <address> --subscribe`.
6. **Record the commits.** Name each commit of the work in the result in step 7, as `<sha> (<repo>)` ([[dev-knw-task-commits]]).
7. **Set the state.** Write the result with the commits: `ops task result <address> "<summary>. Commits: <sha> (<repo>), …. Session: <ORBH_SESSION_ID>"`. A task that exists from step 1 keeps the text of its result of before. Close the task when the person confirms ([[dev-sk-task-close_task]]), or leave it open for a review ([[dev-wkfl-task-review_task]]). In a headless session, close it only when the prompt says so.
8. **Copy the state into the note:** `flint shard task task-sync <address>` (also after a close).
9. Report the address, the note, the place, the commits, and the state to the person (or in the result).

# Output

- A task note and an Ops task, linked both ways, with the work, its place, and its commits; the task is an object of the session
- The task with its result, which names the commits (closed when confirmed)
