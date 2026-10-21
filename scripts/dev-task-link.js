#!/usr/bin/env node
// task-link of the Tasks shard (Task 1291, contract N6): link a task note and an Ops task both ways.
// Invocation: flint shard task task-link "<(Task) N Title>" [--ops <ref>] [--org <org>]
//   [--type <type>] [--repo <name>] [--unplaced | --subsection <s> | --project <p> [--folder <f>] | --master]
//   [--priority <p>] [--assign <member>]
// The note is a title, a wikilink, or a path under Mesh/. Its note address comes from `flint resolve @v1//task/<n>`.
// - With --ops <ref>: it sets the note of that Ops task (`<ops> task note <ref> <address> --label …`), writes the
//   Ops address into the field `ops` of the note, and copies the state of the Ops task into the note, as task-sync.
// - With no --ops, and a note that has `ops`: it links the same Ops task again (a repair of the Ops side), and copies
//   the state too.
// - With no --ops, and a note with no `ops`: it makes the Ops task with no body (`<ops> task create "<name>" --note …`;
//   the type is --type, else the field task-type of the note; with no placement option, the task is unplaced).
// It refuses a note that already links another Ops task, and an Ops task that already has another note.
// When the create fails, the note does not change. A refusal of Ops wrote nothing. A create that made the task and failed
// after it names task-link --ops <id>. When the outcome is not known, the refusal names a search and no create command.
// Output: one JSON document { number, title, path, note, noteLabel, ops, created }.

const fs = require('fs');
const path = require('path');

// The shared code: note-lib.js in the shard, dev-note-lib.js in the source.
const n = require(fs.existsSync(path.join(__dirname, 'note-lib.js')) ? './note-lib.js' : './dev-note-lib.js');

const { lib, TaskError } = n;

const USAGE = 'Usage: flint shard task task-link "<(Task) N Title>" [--ops <ref>] [--org <org>] [--type <type>] [--repo <name>] [--unplaced | --subsection <s> | --project <p> [--folder <f>] | --master] [--priority <p>] [--assign <member>].';

/** Two Ops addresses name the same task when their ids are equal (a type change moves task/<id> to task.dev/<id>). */
function sameTask(a, b) {
  const id = (address) => {
    const match = /^@v1\/([^/#\s]+)\/task(?:\.[a-z][a-z0-9]*)?\/([^/#\s]+)#ops$/.exec(String(address || '').trim());
    return match ? `${match[1]}/${match[2]}` : String(address || '').trim();
  };
  return id(a) === id(b);
}

n.run('task-link', (argv) => {
  const { positional, options } = n.parseArgs(argv, {
    values: ['ops', 'org', 'type', 'repo', 'subsection', 'project', 'folder', 'priority', 'assign'],
    flags: ['unplaced', 'master'],
    usage: USAGE,
  });
  if (positional.length !== 1) throw new TaskError(`Give one task note. ${USAGE} Nothing changed.`);
  const createOptions = ['type', 'repo', 'subsection', 'project', 'folder', 'priority', 'assign', 'unplaced', 'master'].filter((key) => options[key] !== undefined);
  const root = n.flintRoot();
  const found = n.findNote(root, positional[0]);
  const note = n.readNote(root, found.file);
  const target = options.ops || note.ops || null;
  if (target && createOptions.length > 0) {
    throw new TaskError(`--${createOptions[0]} is an option of a new Ops task, but this run links ${target}. Nothing changed.`);
  }
  if (options.ops && note.ops && !sameTask(options.ops, note.ops)) {
    // A plain id cannot be compared with the address of the note: read the address of --ops first.
    const given = n.OPS_ADDRESS.test(options.ops) ? options.ops : n.showTask(root, options.ops, options.org).address;
    if (!sameTask(given, note.ops)) {
      throw new TaskError(`${found.title} already links the Ops task ${note.ops}. To link ${given}, clear the field ops of the note first. Nothing changed.`);
    }
  }
  const flint = n.flintInfo(root);
  const address = n.noteAddress(root, found.number, found.file);
  const label = n.noteLabel(found.number, flint.name);
  const orgArgs = options.org ? ['--org', options.org] : [];
  let opsAddress;
  let created = false;
  let state = null;

  if (target) {
    // Link a present Ops task. It must have no note, or this note.
    const shown = n.showTask(root, target, options.org);
    const present = n.opsNote(shown);
    if (present && present.toLowerCase() !== address.toLowerCase()) {
      throw new TaskError(`The Ops task ${shown.address} already has the note ${present}. Read that note first: it can be the right note. To link this note in its place, clear the note of the Ops task ${n.opsStepLead()}: ${n.opsStep(['task', 'note', shown.address, '--clear'])}, then run this command again. Nothing changed.`);
    }
    // The state of the Ops task goes into the note after the link. An unknown status refuses here, before any write.
    state = n.opsState(shown);
    const args = ['task', 'note', shown.address, address, '--label', label, '--json'];
    const set = n.runOps(args, root);
    if (!set.ok) throw new TaskError(`The link in Ops failed (${n.opsText(args)}): ${set.error}. The note did not change.`);
    opsAddress = set.json && typeof set.json.address === 'string' && set.json.address ? set.json.address : shown.address;
  } else {
    // Make the Ops task, with no body: the note holds the content.
    const type = options.type || note.type || '';
    if (options.repo && (!type || type === 'task')) throw new TaskError('--repo is a field of a typed task: give --type task.dev too. Nothing changed.');
    const args = [
      'task', 'create', found.name,
      '--note', address, '--note-label', label,
      ...(type && type !== 'task' ? ['--type', type] : []),
      ...(options.repo ? ['--repo', options.repo] : []),
      ...n.placementArgs(options),
      ...(options.priority ? ['--priority', options.priority] : []),
      ...(options.assign ? ['--assign', options.assign] : []),
      ...orgArgs,
      '--json',
    ];
    const made = n.runOps(args, root);
    const outcome = n.createOutcome(made);
    // A plain id is read in the org of the create (--org, else the org of the placement address).
    const link = (ops) => n.shellCommand(['flint', 'shard', 'task', 'task-link', found.title, '--ops', ops, ...n.createOrg(options).args]);
    if (outcome.kind === 'created') {
      throw new TaskError(`${n.createdText(outcome, made, options.repo, n.createOrg(options).args)} Link it: ${link(outcome.id)}. The note did not change.`);
    }
    if (outcome.kind === 'refused') {
      throw new TaskError(`Ops refused the create of the Ops task (${n.opsText(args)}): ${made.error}. Ops wrote nothing. The note did not change.`);
    }
    if (outcome.kind === 'unknown') {
      const check = n.unknownCheck(found.title, found.name, address, options, true);
      throw new TaskError(`The outcome of the create of the Ops task is not known (${n.opsText(args)}): ${made.error || 'the output has no id'}. The note did not change. ${check.text}`);
    }
    const { id } = outcome;
    created = true;
    opsAddress = typeof made.json.address === 'string' && made.json.address ? made.json.address : null;
    if (!opsAddress) {
      // The write is done, but the read of its address failed. Never create a second Ops task: read it again.
      try {
        opsAddress = n.showTask(root, id, options.org).address;
      } catch (error) {
        if (!(error instanceof TaskError)) throw error;
        throw new TaskError(`The Ops task ${id} exists, but its address cannot be read: ${error.message} Run again: ${n.shellCommand(['flint', 'shard', 'task', 'task-link', found.title, '--ops', id, ...n.createOrg(options).args])}`);
      }
    }
  }

  lib.withLocks(root, [found.file], () => {
    const doc = lib.readDoc(root, found.file, 'task');
    const changed = n.setField(doc, 'ops', opsAddress);
    lib.trackSession(doc, process.env.ORBH_SESSION_ID || null);
    if (changed) lib.appendTaskLog(doc, `- ${lib.today()}: Linked to the Ops task ${opsAddress}${created ? ' (a new Ops task)' : ''} (${n.provenance('task-link')}).`);
    if (state) n.writeState(doc, { ...state, ops: opsAddress }, 'task-link');
    lib.writeDoc(doc);
  });
  n.printJson({ number: found.number, title: found.title, path: path.relative(root, found.file), note: address, noteLabel: label, ops: opsAddress, created });
  return null;
});
