---
description: "Place a task with the hint rule: one clear hint sets the home, two or more add related links, no hint leaves the task unplaced"
---

> [!important] THIS FILE IS AN INSTRUCTION. WHEN REFERENCED IT IS MEANT TO BE TAKEN AS AN ACTION.

Run `flint shard start task` if you haven't already.

# Skill: Place Task

Give a task its home, or its `related` links, from the placement hints.

# Input

- The ref of the task
- (Optional) A place that the person or the prompt gives. It wins over the hints.

# Actions

1. **A given place.** When the person or the prompt gives the place, set it: `ops task home <ref> --subsection <id>`, `ops task home <ref> --backlog --project <id> [--folder <id>]`, or `ops task home <ref> --backlog` (the org master backlog). Then skip steps 2 to 4 (the hints), and continue at step 5.
2. **Get the hints.** Read the Flint id: `flint org show --json` (the value `flint.id`). Then run `ops task hints --flint <Flint id> --text "<title of the task>" --json`. For a `task.dev`, add `--repo <name>` with its field `repo`.
3. **Count the clear hints.** A hint is clear when its place fits the work of the task. Drop a hint whose place does not fit, also when its score is high.
4. **Apply the rule.**
   - **One clear hint:** set the home from the `home` of the hint: `{kind: "subsection", subsectionId}` gives `ops task home <ref> --subsection <subsectionId>`; `{kind: "backlog", projectId}` gives `ops task home <ref> --project <projectId>`.
   - **Two or more clear hints:** add one `related` link for each, with the `label` of the hint. A hint with `deliverableId` (its home is a subsection, or the backlog of a deliverable) gives `ops task relate <ref> deliverable <deliverableId> --label "<label>"`. A hint with no `deliverableId` (a project backlog) gives `ops task relate <ref> project <projectId> --label "<label>"`. Never relate a deliverable by its title: two projects can have deliverables with the same title (`deliverable_ambiguous`). Leave the task unplaced.
   - **No clear hint:** leave the task unplaced, with no project or deliverable link.
5. **A repository.** A `task.dev` always has a `repo` link with its field `repo`, also when step 1 set a given place. `ops task create --repo <name>` adds the link at the create. When the field came in another way (`ops task field <ref> repo <name>`), or the `relations` of `ops task show <ref> --json` have no `repo` link, add it: `ops task relate <ref> repo <name>`. A second add changes nothing. This link is not a home. The hints of `--repo <name>` read these links, so a task with no `repo` link cannot help a later task to find its project.
6. **Unplace.** To remove a home, run `ops task home <ref> --none`.
7. Tell the person (or put in the result) the home or the `related` links, and the hints that you used.

# Output

- The task has one home, or two or more `related` links and no home, or no home and no project or deliverable link
- A `task.dev` has a `repo` link with its field `repo`, in each case
