---
description: "Make a continuation of a task with ops task continue: the new task gets continues-from, and an open old task closes as superseded"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start task` if you haven't already.

# Skill: Continue Task

Make a new task that continues an old task: more work after a close, or the rest of the work of a task that stops.

# Input

- The ref of the old task
- (Optional) The title of the new task (default: `<old title> (continued)`)
- (Optional) The reason

# Actions

1. **Read the old task.** Run `ops task show <ref> --json`, and read its task note. Find the items of the definition of done that are not met, and the new scope.
2. **Continue.**
   ```bash
   ops task continue <ref> [--title "<title>"] --json
   ```
   The new task gets the home and the type of the old task, and `continues-from` the old task. An open old task closes with `superseded`. A done old task stays done. The output gives the new task as `taskId` and `address`. When the output has `address: null`, the write is done: do not run it again. Run the read that the stderr message names (`ops task show <id> --json`) to get the address.
3. **Give the new task its task note.** Write the body of the note to a temporary file: the context (with the address and the note of the old task), the scope, and the items that the new task carries; the reason goes under `# Notes`. Then make the note and link it: `flint shard task task-new --ops <new address> --body-file <file>`.
4. **Write the result of the old task** when it was open: `ops task result <old ref> "Continued by <new address>. <reason>"`. Then sync the old note: `flint shard task task-sync <old address>`, and add a `# Task Log` line with the new task.
5. **Pin again.** When the session does the new work, pin the new task: `flint orbh task pin <new address>`.
6. Report the address and the note of the new task.

# Output

- A new task with `continues-from` the old task, with its task note
- The old task `done · superseded` (when it was open), or still done
