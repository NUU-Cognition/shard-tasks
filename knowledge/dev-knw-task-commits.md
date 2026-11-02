---
description: "The WIP commit rule of a task: the task object first, the machine branch, only your paths, the subject [OR] wip: <Flint name>/Task <short id> <what changed>, the trailers of the hook, the commits named in the result, and the check"
---

# Knowledge: Task Commits

Work on a task that changes a repository makes WIP commits. Each commit names its task in its subject, and the result of the task names each commit. Read this file before you commit the work of a task. The general model is in [[dev-knw-task-model]].

## The WIP Commit Rule

The rules of OrbRepo stay: the machine branch, explicit staging, and no rewrite of history.

1. **Add the task first.** The session adds the task as an object before the first edit: `flint orbh objects add <address> --subscribe`. For a task group, add each task of the task group.
2. **Check the branch.** Work on the machine branch of this machine (for example `nathan-main`). Never commit WIP to `dev` or `main`.
3. **Stage only your files.** `git commit -m "<message>" -- <path>...`. Never use `git add -A`, `git add .`, or `git commit -a`.
4. **The subject.** `[OR] wip: <Flint name>/Task <short id> <what changed>`. The Flint name has no `(Flint)` prefix (for example `NUU Flint`). The short id is the first 8 characters of the Ops id of the task. Add a short body that says what changed.
5. **The trailers.** The commit hook of Orbh adds `Orbh-Fleet` and `Orbh-Session`. Do not write a trailer by hand. The subject names the task (rule 4).
6. **Record the commit.** Name each commit in the result of the task, as `<sha> (<repo>)`: `ops task result <ref> "<summary>. Commits: <sha> (<repo>), …. Session: <ORBH_SESSION_ID>"`. Ops has no field for commits, and there is no `ops task commit`. A new result replaces the result of before: keep each commit of before in the new text.
7. **Check the commit.** `git show --stat HEAD` must list only your paths.

Example:

```bash
git commit -m "[OR] wip: NUU Flint/Task jd7f3k2m the result of the task detail" \
  -m "The task detail shows the result of the task under its title." \
  -- apps/nuu-ops/src/components/tasks/task-detail-dialog.tsx
ops task result @v1/nuucognition/task/jd7f3k2m9n8p4q5r6s7t8u9v0w1x2y3z#ops \
  "The task detail shows the result. Commits: $(git rev-parse --short HEAD) (main). Session: $ORBH_SESSION_ID"
```

## The Commits in the Result

- The result is the record of the commits. Write it after the last commit of the work (Stage 3 of [[dev-wkfl-task-do_task]]). When the work is long, write it after each commit too, with each commit so far.
- The `Session:` part names the session of the work. A review reads it to check that it is a second session ([[dev-wkfl-task-review_task]]). With no Orbh session, leave it out.
- The subject of each commit names the task. So `git log --grep "Task <short id>"` finds each commit of a task, also a commit that the result does not name yet.
- The field `wip-commits` of the task note stays empty: the result holds the commits.
- The repository of the work is a `repo` related link of the task (`task-new --repo <name>`, or `ops task relate <ref> repo <name>`), and `git-repos` of the task note.
