# Migrations

Migration notes for Tasks. Latest version at top, separated by `---`.

## 0.6.1

No migration of this shard. The shard is deprecated: install the Operations shard 0.8.0 (`flint shard install @nuucognition/operations@^0.8`), and run its migration `mig-ops-0.7.0-to-0.8.0` (`flint shard migrate run ops`), or its setup after a new install. Each of them uninstalls this shard. An open invocation of a live session delays the uninstall until that session closes it.

---

## 0.6.0

No migration. The release adds text only: no file, step id, or invocation changes. A session that has a task as an object now answers a person first, in the place where the person wrote.

---

## 0.5.0

No migration. The step ids of the invocations do not change, so an open invocation of 0.4.x continues. A Flint that runs `do_task`, `create_and_do_task`, or `do_task_group` now gets exactly one review request in Ops for each finished task, right after its result and before any close.
