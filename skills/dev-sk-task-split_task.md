---
description: "Split a task into new parts with ops task split: each part keeps the home and the relations, and an open old task closes"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start task` if you haven't already.

# Skill: Split Task

Split a task that is too big, or that holds two intents, into new tasks.

# Input

- The ref of the task
- The title of each part (two or more)
- (Optional) `--keep-open`: the old task stays open (for example, it keeps a part of the work)

# Actions

1. **Read the task.** Run `ops task show <ref> --json`, and read its task note. Divide the definition of done between the parts. Each item goes to one part.
2. **Check the reason.** When a part serves the intent of the task, it is a subtask in Strike, not a new task. Split only when each part is a coherent unit of work alone.
3. **Split.**
   ```bash
   ops task split <ref> --part "<title 1>" --part "<title 2>" [--keep-open] --json
   ```
   Each part gets the home and the relations of the old task. Each part gets `split-from` the old task. An open old task closes, unless `--keep-open`. The output lists each part as `{id, title, address}`. When the output has `address: null`, the write is done: do not run it again. Run the read that the stderr message names (`ops task show <id> --json`) to get the address.
4. **Give each part its task note.** Write the body of the note of each part to a temporary file: its context (with the address of the old task), its scope, and its items of the definition of done. Then make the note and link it to the part: `flint shard task task-new --ops <part address> --body-file <file>` (the title comes from the part).
5. **Sync the old note:** `flint shard task task-sync <old address>`. Its status becomes `done` (unless `--keep-open`). Add a `# Task Log` line in the old note with the address of each part.
6. **Move the attachments that matter.** A note of the old task that serves one part: `ops task attach <part ref> note "<Mesh path>"`.
7. **Add the part.** When the old task is an object of the session, add the part that the session does now as an object: `flint orbh objects add <part address> --subscribe`. Remove the item of the old task when the work no longer needs it.
8. **Chain or group the parts** when they have an order or are done together: [[dev-sk-task-chain_tasks]], [[dev-sk-task-group_tasks]].
9. Report the address and the note of each part.

# Output

- Two or more new tasks with `split-from` the old task, each with its task note
- The old task `done` (or open with `--keep-open`)
