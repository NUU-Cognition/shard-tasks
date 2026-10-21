---
description: "Chain tasks in an order with ops task chain, so that each task is ready when the task before it is done"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start task` if you haven't already.

# Skill: Chain Tasks

Put tasks in an order of work (for example design, then build, then ship).

# Input

- The refs of the tasks, in order (two or more)

# Actions

1. **Check the order.** A chain is an order of separate tasks. When the tasks are steps of one intent, they are subtasks in Strike, not a chain.
2. **Chain.**
   ```bash
   ops task chain <first ref> <second ref> [<third ref>...]
   ```
   Each task after the first gets `after` the task before it. A task holds at most one `after` link: a new chain replaces the old link. A cycle refuses with `task_link_cycle`.
3. **Check.** Run `ops task show <ref> --json` for the second task: `links.after` names the first task, and `task.chainReady` is `false` while the first task is open.
4. **Unchain.** To remove the link of one task, run `ops task unchain <ref>`.
5. Report the chain in order, with the address of each task.

# Output

- Each task after the first has `after` the task before it
- A task is ready when the task before it is done
