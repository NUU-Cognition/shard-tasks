#!/usr/bin/env node
// task-sync of the Tasks shard (Task 1291, contract N6): copy the state of the Ops task into its task note, in one
// direction only. Ops owns the status, the stage, the type, and the outcome.
// Invocation: flint shard task task-sync "<(Task) N Title>" (or the Ops address of the task: its field note names the note)
// It reads `<ops> task show <ops of the note> --json`, and writes into the note:
// - `status`: todo → todo; doing → in-progress; an open task with the flag blocked (any value that is set) → blocked;
//   done with the outcome completed (or no outcome) → done, dropped → deprecated, superseded → superseded;
// - `stage` and `task-type`: the copy (empty for an untyped task);
// - `completed`: the date of the close when the task is done, else empty;
// - `ops`: the current Ops address (a type change or an undo can move it).
// A change of the status or the stage adds one Task Log line. A note with no `ops` is a refusal that names task-link.
// Output: one JSON document { number, title, path, ops, status, stage, type, changed, noteLinked }.

const fs = require('fs');
const path = require('path');

// The shared code: note-lib.js in the shard, dev-note-lib.js in the source.
const n = require(fs.existsSync(path.join(__dirname, 'note-lib.js')) ? './note-lib.js' : './dev-note-lib.js');

const { lib, TaskError } = n;

const USAGE = 'Usage: flint shard task task-sync "<(Task) N Title>" (or the Ops address of the task).';

n.run('task-sync', (argv) => {
  const { positional } = n.parseArgs(argv, { values: [], flags: [], usage: USAGE });
  if (positional.length !== 1) throw new TaskError(`Give one task note. ${USAGE} Nothing changed.`);
  const root = n.flintRoot();
  const found = n.findNoteOf(root, positional[0]);
  const before = n.readNote(root, found.file);
  if (!before.ops) {
    throw new TaskError(`${found.title} has no field ops: it links no Ops task. Link it first: ${n.shellCommand(['flint', 'shard', 'task', 'task-link', found.title])}. Nothing changed.`);
  }

  // The read of Ops runs before the lock of the note.
  const shown = n.showTask(root, before.ops);
  const next = n.opsState(shown);
  const linked = n.opsNote(shown);
  let noteLinked = null;
  if (linked) {
    const id = before.id ? before.id.toLowerCase() : '';
    noteLinked = id !== '' && linked.toLowerCase().includes(`/task/${id}#`);
    if (!noteLinked) process.stderr.write(n.scrub(`warning: the Ops task ${shown.address} has the note ${linked}, not this note. Run task-link to repair it.\n`));
  }

  const changed = lib.withLocks(root, [found.file], () => {
    const doc = lib.readDoc(root, found.file, 'task');
    const fields = n.writeState(doc, next, 'task-sync');
    lib.writeDoc(doc);
    return fields;
  });

  n.printJson({
    number: found.number,
    title: found.title,
    path: path.relative(root, found.file),
    ops: next.ops,
    status: next.status,
    stage: next.stage || null,
    type: next['task-type'] || null,
    changed,
    noteLinked,
  });
  return null;
});
