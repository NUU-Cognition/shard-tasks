---
description: "Make or change a task group with ops task group: a set of tasks that one session does together, each task still a full task"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start task` if you haven't already.

# Skill: Group Tasks

Make a task group for tasks that are done together, usually in one session, or change a task group.

# Input

- The title of the task group, or the ref of a task group (`@v1/<org>/taskgroup/<id>#ops`)
- The refs of the tasks to add or to remove

# Actions

1. **Check the shape.** A task group keeps each task as a full task: its own home, status, stage, and result. Tasks with one intent are a merge ([[dev-sk-task-merge_tasks]]). Tasks in an order are a chain ([[dev-sk-task-chain_tasks]]). Many sessions on one task are a fleet, not a task group.
2. **Make the task group.**
   ```bash
   ops task group create "<title>" --task <ref> [--task <ref> ...] [--body "<text>"] --json
   ```
   Keep the `address` of the output. When the output has `address: null`, the write is done: do not run it again. Run the read that the note on stderr names (`ops task show <id> --json`) to get the address. A task can be in at most 20 task groups, and a task group holds at most 50 tasks.
3. **Change the task group.**
   - Add: `ops task group add <group> <ref>...`
   - Remove: `ops task group remove <group> <ref>...` (the tasks stay)
   - Delete: `ops task group delete <group>` (the tasks stay). Delete only when the person asks.
4. **Read the task group.** `ops task group show <group> --json` gives its `address` (always), its tasks, `open`, and its attachments. `ops task group list --open` lists the open task groups. A task group is open while one of its tasks is open.
5. **Pin the task group** when this session does its tasks: `flint orbh task pin <group address>` ([[dev-sk-task-pin_task]]). Each task of the task group then shows the session attachment.
6. Report the address of the task group and its tasks.

# Output

- A task group with its tasks, or the changed task group
