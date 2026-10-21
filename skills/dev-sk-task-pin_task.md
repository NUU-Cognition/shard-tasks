---
description: "Pin a task or a task group to this Orbh session, check the pin, and sync it to Ops"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start task` if you haven't already.

# Skill: Pin Task

Pin a task or a task group to this session, so that the session, the Page, the commits, and Ops know the work.

# Input

- The ref of a task or a task group: a Convex id or an address (`@v1/<org>/task/<id>#ops`, `@v1/<org>/task.dev/<id>#ops`, or `@v1/<org>/taskgroup/<id>#ops`)
- (Optional) `--org <slug>` when the ref is a Convex id of another org than the active org

# Actions

1. **Read the target.** Run `ops task show <ref> --json` (for a task group: `ops task group show <ref> --json`). Use the `address` of the output from now on. When the target is done, do not pin it: continue it with [[dev-sk-task-continue_task]], or reopen it when the person asks (`ops task reopen <ref>`).
2. **Pin.** Run `flint orbh task pin <address>` (for a plain Convex id, add `--org <slug>`). The command reads the ref in Ops, sets `core:task` and `core:task-info`, and attaches the session in Ops (`ops task attach <address> session <session address> --session-id <id> …`). The session address has the form `@v1/<org>/session/<uuid>#flint/<slug>#<machine>`. When Ops does not resolve the ref, the pin refuses and changes nothing: check the ref with `ops task show <ref>`.
3. **Check.** Run `flint orbh task show`. The pin shows the title, the status, the stage, and the address. The Page shows the `TASK` line.
4. **After an undo.** An undo of the delete of a task can give it a new id. `ops task show <old address> --json` then gives the new canonical address, and `flint orbh task show` or `flint orbh task sync` updates the pin to it. Use the new address in commits, prompts, and results.
5. **When the attach failed.** The pin is set with `sync: "pending"`, and the command prints the retry command. Continue the work. Run `flint orbh task sync` later: it retries the attach, sends the work state of the session, and refreshes the pin. `--no-sync` on the pin also gives `sync pending`.
6. **When you change the work.** Pin the next task with `flint orbh task pin <ref>`: the old pin moves to `previous`, and its Ops attachment stays. Run `flint orbh task unpin` only when the session does no more work on a task. The unpin makes no Ops call: the Ops attachment stays.
7. **When you dispatch a subagent for this work.** Put the address of the pin in the prompt, and tell the subagent to pin it.
8. With no Orbh session (`ORBH_SESSION_ID` is not set), no pin is possible. Attach the work in another way when it helps: `ops task attach <ref> note "<Mesh path>"`.

# Output

- `core:task` holds the address, and the Page shows the `TASK` line
- Ops has a `session` attachment on the task or the task group (or the pin is `sync pending`)
