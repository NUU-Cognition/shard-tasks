# Migrations

Migration notes for Tasks. Latest version at top, separated by `---`.

## 0.6.0

No migration. The release adds text only: no file, step id, or invocation changes. A session that has a task as an object now answers a person first, in the place where the person wrote.

---

## 0.5.0

No migration. The step ids of the invocations do not change, so an open invocation of 0.4.x continues. A Flint that runs `do_task`, `create_and_do_task`, or `do_task_group` now gets exactly one review request in Ops for each finished task, right after its result and before any close.
