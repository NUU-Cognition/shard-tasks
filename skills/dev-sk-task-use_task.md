---
description: "Keep a task in the session as an object of the Objects Protocol: add it with subscribe, read it, take it for a change that must not collide, return it, and remove it when the work ends"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start task` if you haven't already.

# Skill: Use Task

Keep a task in the context of this session as an object of the Objects Protocol, so that each turn of the session reads the current task. The general rules of a use of an object are in the skill `sk-foh-use_object` of the Orbh shard.

# Input

- The ref of a task or a task group: a Convex id or an address (`@v1/<org>/task/<id>#ops` or `@v1/<org>/taskgroup/<id>#ops`). An old address `@v1/<org>/task.dev/<id>#ops` still resolves.
- (Optional) `--org <slug>` for `ops task show` when the ref is a Convex id of another org than the active org

# Actions

1. **Read the target.** Run `ops task show <ref> --json` (for a task group: `ops task group show <ref> --json`). Use the `address` of the output from now on: an object verb takes an address, not a Convex id. When the task is done, do not add it: continue it with [[dev-sk-task-continue_task]], or reopen it when the person asks (`ops task reopen <ref>`).
2. **Add.** Run `flint orbh objects add <address> --subscribe`. The mode `link` is the default: the session reads the task again at each turn boundary. `--subscribe` sends a message from `orbh:objects` when the task changes, and the message wakes an awaiting session. The command prints the block of the item, with its id (`ob-…`). When the add gives `not-configured` (exit 3), the NUU CLI has no sign-in: ask the person to run `nuu login`. When it gives `not-found` (exit 5), check the ref with `ops task show <ref>`.
3. **A task group.** Do not add the task group: its object does not resolve. Add each task of the task group as an object, one item for each task (at most 20 items).
4. **Check.** Run `flint orbh objects list` for the items, and `flint orbh objects show <id>` for the block of one item (the title, the state, the version, and the hold). The Page shows each item in the `OBJECTS` block. A changed task shows its full block with `state: changed`: read it before you continue.
5. **Take the task for a change that must not collide.** When another session must not change the task at the same time (for example a series of mesh writes, or a result and a close), take it: `flint orbh objects take <address>`. Use `flint orbh objects chair <address>` when other sessions can join after a request. Do the change, then return the task: `flint orbh objects return <address>`. Orbh renews a hold while the session lives, and returns it at the end of the session. The Page shows each hold in the part `Holds` of the `OBJECTS` block.
6. **When the task is held.** When a verb answers `held` (exit 9), another actor holds the task. Send a request: `flint orbh objects request <address> --note "<why>"`, and tell the person or your dispatcher. Do not get around the hold. Answer each open request to you, as `sk-foh-use_object` says.
7. **After an undo, or with an old address.** An undo of the delete of a task can give it a new id. An old address `task.dev/<id>` resolves to the address `task/<id>`. `ops task show <old address> --json` gives the canonical address. Add the new address as an object, and remove the item of the old address. Use the new address in commits, prompts, and results.
8. **When the work changes.** Add each task that the work uses: a session can hold up to 20 items. Remove a task with `flint orbh objects remove <id>` only when the work no longer needs it. The record of the item stays as a tombstone.
9. **When you dispatch a subagent for this work.** Put the address of the task in the prompt. The dispatcher can give the task at the launch: `flint orbh launch … --object <address>=subscribe`.
10. With no Orbh session (`ORBH_SESSION_ID` is not set), no item is possible. Attach the work in another way when it helps: `ops task attach <ref> note "<Mesh path>"`.

# Output

- The task is an item of the session (`link`, with subscribe), and the Page shows it in the `OBJECTS` block
- Each hold that the session took is returned after its change
