---
description: "Split a task into new parts with ops task split: each part keeps the home, the type, and the relations, and the old task closes as superseded"
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
   Each part gets the home, the type, the type version, and the relations of the old task, and no stage. Each part gets `split-from` the old task. The old task closes with `superseded`, unless `--keep-open`. The output lists each part as `{id, title, address}`. When the output has `address: null`, the write is done: do not run it again. Run the read that the stderr message names (`ops task show <id> --json`) to get the address.
4. **Give each part its task note.** Write the body of the note of each part to a temporary file: its context (with the address of the old task), its scope, and its items of the definition of done. Then make the note and link it to the part: `flint shard task task-new --ops <part address> --body-file <file>` (the title and the type come from the part). For a `task.dev` with a complete scope, set `ops task stage <part address> scoped`, then `flint shard task task-sync <part address>`.
5. **Sync the old note:** `flint shard task task-sync <old address>`. Its status becomes `superseded` (unless `--keep-open`). Add a `# Task Log` line in the old note with the address of each part.
6. **Move the attachments that matter.** A note of the old task that serves one part: `ops task attach <part ref> note "<Mesh path>"`.
7. **Pin again.** When the session pinned the old task, pin the part that the session does now: `flint orbh task pin <part address>`.
8. **Chain or group the parts** when they have an order or are done together: [[dev-sk-task-chain_tasks]], [[dev-sk-task-group_tasks]].
9. Report the address and the note of each part.

# Output

- Two or more new tasks with `split-from` the old task, each with its task note
- The old task `done · superseded` (or open with `--keep-open`)
