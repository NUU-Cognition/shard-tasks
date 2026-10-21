#!/usr/bin/env node
// task-new of the Tasks shard (Task 1291, contract N6): make a task in two parts, linked both ways.
// Invocation: flint shard task task-new "<title>" [--type <type>] [--repo <name>] [--org <org>]
//   [--unplaced | --subsection <s> | --project <p> [--folder <f>] | --master] [--priority <p>] [--assign <member>]
//   [--body-file <path>]
//        flint shard task task-new ["<title>"] --ops <ref> [--org <org>] [--body-file <path>]
// 1. It writes the task note: `flint helper artifact create Task` reserves the number and writes the note in one step
//    (the template tmp-proj-task-v0.2, with the fields task-type and, later, ops). --body-file gives the body of the
//    note (the Markdown after the frontmatter); with no --body-file, the body has the headings of the template.
// 2. It gets the note address: `flint resolve @v1//task/<n> --json` (the field address).
// 3. It makes the Ops task with no body: `<ops> task create "<title>" --note <address> --note-label "Task <n> · <Flint>"
//    … --json`. With no placement option, the Ops task is unplaced.
//    With --ops <ref>, it makes no Ops task: it writes the note of an Ops task that exists and has no note (a part of a
//    split, a continuation, the survivor of a merge with --title), and links it with `<ops> task note`. The title and
//    the type come from the Ops task, unless a title is given.
// 4. It writes `ops` (the Ops address) into the note, stamps the session in `orb`, and adds a Task Log line. With
//    --ops, it also copies the state of the Ops task into the note (status, stage, task-type, completed), as task-sync.
// Output: one JSON document { number, title, path, note, noteLabel, ops }. When the Ops part fails, the note stays,
// `ops` is null, `error` says what failed, `next` names the command to run next (quoted for a POSIX shell), and the
// exit code is 1:
// - Ops refused the create before any write: `next` is task-link with the create options of this run.
// - The create made the task, and a step after it failed (`Created task <id>, but …`): `opsId` is the task, and
//   `next` is task-link --ops <id>. A second create would make a second Ops task for one note.
// - The outcome is not known (a network error, a time-out, bad_response, an unknown code, no JSON error): `next` is a
//   search in the org of the create, and `ifFound` is task-link --ops <id> (for the task with the note of this note).
//   There is no create command: a search cannot prove that no task exists.

const fs = require('fs');
const path = require('path');

// The shared code: note-lib.js in the shard, dev-note-lib.js in the source.
const n = require(fs.existsSync(path.join(__dirname, 'note-lib.js')) ? './note-lib.js' : './dev-note-lib.js');

const { lib, TaskError } = n;

const USAGE = 'Usage: flint shard task task-new "<title>" [--type <type>] [--repo <name>] [--org <org>] [--unplaced | --subsection <s> | --project <p> [--folder <f>] | --master] [--priority <p>] [--assign <member>] [--body-file <path>], or flint shard task task-new ["<title>"] --ops <ref> [--org <org>] [--body-file <path>].';

/** The options of a new Ops task: --ops (a present Ops task) refuses them. */
const CREATE_OPTIONS = ['type', 'repo', 'subsection', 'project', 'folder', 'priority', 'assign', 'unplaced', 'master'];

/** The priorities of the note template. Ops also has urgent: the note then keeps an empty priority. */
const NOTE_PRIORITIES = ['low', 'medium', 'high'];

/** The headings of the body of tmp-proj-task-v0.2, for a note with no --body-file. */
const SKELETON = ['# Context', '', '# Task Description', '', '# Task Requirements', '', '# Definition of Done', '', '# Task Log', '', '# Notes', ''];

/** The content of `flint helper artifact create`: the frontmatter of tmp-proj-task-v0.2 and the body. */
function noteContent(options, body) {
  const lines = [
    '---',
    'id: {{id}}',
    'tags:',
    '  - "#proj/task"',
    'status: todo',
    'from:',
    'due:',
    'completed:',
    `priority:${NOTE_PRIORITIES.includes(options.priority) ? ` ${options.priority}` : ''}`,
  ];
  if (options.type && options.type !== 'task') lines.push(`task-type: ${options.type}`);
  lines.push(
    'template: "[[tmp-proj-task-v0.2]]"',
    'authors:',
    '  - "{{author}}"',
  );
  if (options.repo) lines.push('git-repos:', `  - ${JSON.stringify(options.repo)}`);
  lines.push('wip-commits:', 'checkpointed:', '---', '');
  return `${lines.join('\n')}\n${body}`;
}

/** The body of the note: the --body-file, or the headings of the template. */
function noteBody(options) {
  if (!options['body-file']) return `${SKELETON.join('\n')}\n`;
  let text;
  try {
    text = fs.readFileSync(path.resolve(options['body-file']), 'utf8');
  } catch (error) {
    throw new TaskError(`The --body-file cannot be read: ${error.message}. Nothing changed.`);
  }
  if (text.startsWith('---')) throw new TaskError('The --body-file has a frontmatter. Give only the body: the script writes the frontmatter. Nothing changed.');
  if (/\{\{(?:number|id|name|author)\}\}/.test(text)) {
    throw new TaskError('The --body-file has a token ({{number}}, {{id}}, {{name}}, or {{author}}). Write the text with no token. Nothing changed.');
  }
  return text.endsWith('\n') ? text : `${text}\n`;
}

/** Remove an authors item with no Name (the token of a machine with no Name), so that the note has no empty item. */
function dropEmptyAuthor(doc) {
  const authors = lib.listField(doc, 'authors');
  const empty = authors.items.filter((item) => item.value.trim() === '' || item.value.trim() === '[[]]');
  if (empty.length === 0) return false;
  for (const item of empty.reverse()) {
    doc.lines.splice(item.index, 1);
  }
  return true;
}

/**
 * Write the Ops address into the note, stamp the session, and add a Task Log line. With a state (from opsState), also
 * copy the state of the Ops task into the note.
 */
function writeOps(root, file, address, what, state) {
  lib.withLocks(root, [file], () => {
    const doc = lib.readDoc(root, file, 'task');
    n.setField(doc, 'ops', address);
    lib.trackSession(doc, process.env.ORBH_SESSION_ID || null);
    lib.appendTaskLog(doc, `- ${lib.today()}: ${what} ${address}. Ops holds the status and the stage (${n.provenance('task-new')}).`);
    if (state) n.writeState(doc, { ...state, ops: address }, 'task-new');
    lib.writeDoc(doc);
  });
}

/**
 * The task-link command of a recovery. An Ops address names its org; a plain id needs --org. Without --ops, the
 * command keeps each create option of this run, so that task-link makes the same Ops task.
 */
function recovery(title, options, placement, ops) {
  const words = ['flint', 'shard', 'task', 'task-link', title];
  if (ops) {
    // A plain id is read in the org of the create (--org, else the org of the placement address).
    words.push('--ops', ops, ...(n.OPS_ADDRESS.test(ops) ? [] : n.createOrg(options).args));
    return n.shellCommand(words);
  }
  if (options.org) words.push('--org', options.org);
  if (options.type) words.push('--type', options.type);
  if (options.repo) words.push('--repo', options.repo);
  words.push(...placement);
  if (options.priority) words.push('--priority', options.priority);
  if (options.assign) words.push('--assign', options.assign);
  return n.shellCommand(words);
}

n.run('task-new', (argv) => {
  const { positional, options } = n.parseArgs(argv, {
    values: ['type', 'repo', 'org', 'subsection', 'project', 'folder', 'priority', 'assign', 'body-file', 'ops'],
    flags: ['unplaced', 'master'],
    usage: USAGE,
  });
  const root = n.flintRoot();
  let present = null;
  if (options.ops) {
    const given = CREATE_OPTIONS.find((key) => options[key] !== undefined);
    if (given) throw new TaskError(`--${given} is an option of a new Ops task, but --ops names a task that exists. Nothing changed.`);
    if (positional.length > 1) throw new TaskError(`Give at most one title. ${USAGE} Nothing changed.`);
    // The Ops task must have no note: a second note would leave the first one with no Ops task.
    present = n.showTask(root, options.ops, options.org);
    const note = n.opsNote(present);
    if (note) throw new TaskError(`The Ops task ${present.address} already has the note ${note}. Use task-link with that note. Nothing changed.`);
    // The state of the Ops task goes into the note after the link. An unknown status refuses here, before any write.
    present.state = n.opsState(present);
    if (typeof present.task.type === 'string' && present.task.type !== '' && present.task.type !== 'task') options.type = present.task.type;
  } else if (positional.length !== 1) {
    throw new TaskError(`Give one title. ${USAGE} Nothing changed.`);
  }
  const title = (positional[0] || (present && typeof present.task.title === 'string' ? present.task.title : '')).trim();
  if (title === '') throw new TaskError(`Give a title. ${USAGE} Nothing changed.`);
  if (/[\r\n]/.test(title)) throw new TaskError('The title has a line break. Nothing changed.');
  if (options.repo && (!options.type || options.type === 'task')) {
    throw new TaskError('--repo is a field of a typed task: give --type task.dev too. Nothing changed.');
  }
  const placement = present ? [] : n.placementArgs(options);
  const flint = n.flintInfo(root);
  const body = noteBody(options);

  // 1. The note: the number is reserved and the file is written in one step.
  const temp = n.tempFile('task-note.md', noteContent(options, body));
  let created;
  try {
    created = n.flintJson(['helper', 'artifact', 'create', 'Task', '--title', title, '--content-file', temp.file, '--json'], root, 'The create of the task note');
  } finally {
    temp.remove();
  }
  const relative = created && created.ok === true && Array.isArray(created.created) && typeof created.created[0] === 'string' ? created.created[0] : '';
  if (!relative) throw new TaskError(`flint helper artifact create gives no path of the note: ${JSON.stringify(created)}.`);
  const file = path.resolve(root, relative);
  const found = n.findNote(root, path.basename(file));
  const { number } = found;
  const label = n.noteLabel(number, flint.name);
  const result = { number, title: found.title, path: path.relative(root, found.file), note: null, noteLabel: label, ops: null };

  lib.withLocks(root, [found.file], () => {
    const doc = lib.readDoc(root, found.file, 'task');
    if (dropEmptyAuthor(doc)) doc.changed = true;
    lib.writeDoc(doc);
  });

  // 2. The note address. 3. The Ops task. A failure keeps the note and names task-link.
  try {
    result.note = n.noteAddress(root, number, found.file);
  } catch (error) {
    if (!(error instanceof TaskError)) throw error;
    n.printJson({ ...result, error: error.message, next: recovery(found.title, options, placement, present && present.address) });
    process.exitCode = 1;
    return null;
  }
  const orgArgs = options.org ? ['--org', options.org] : [];
  if (present) {
    // Link the present Ops task. A failure keeps the note and names task-link.
    const noteArgs = ['task', 'note', present.address, result.note, '--label', label, '--json'];
    const set = n.runOps(noteArgs, root);
    if (!set.ok) {
      n.printJson({ ...result, error: `The link in Ops failed (${n.opsText(noteArgs)}): ${set.error}. The note stays.`, next: recovery(found.title, options, placement, present.address) });
      process.exitCode = 1;
      return null;
    }
    const linked = set.json && typeof set.json.address === 'string' && set.json.address ? set.json.address : present.address;
    writeOps(root, found.file, linked, 'Linked to the Ops task', present.state);
    result.ops = linked;
    n.printJson(result);
    return null;
  }
  const args = [
    'task', 'create', title,
    '--note', result.note, '--note-label', label,
    ...(options.type ? ['--type', options.type] : []),
    ...(options.repo ? ['--repo', options.repo] : []),
    ...placement,
    ...(options.priority ? ['--priority', options.priority] : []),
    ...(options.assign ? ['--assign', options.assign] : []),
    ...orgArgs,
    '--json',
  ];
  const made = n.runOps(args, root);
  const outcome = n.createOutcome(made);
  if (outcome.kind === 'created') {
    n.printJson({ ...result, opsId: outcome.id, error: `${n.createdText(outcome, made, options.repo, n.createOrg(options).args)} The note stays.`, next: recovery(found.title, options, placement, outcome.id) });
    process.exitCode = 1;
    return null;
  }
  if (outcome.kind === 'refused') {
    n.printJson({ ...result, error: `Ops refused the create of the Ops task (${n.opsText(args)}): ${made.error}. Ops wrote nothing. The note stays.`, next: recovery(found.title, options, placement, null) });
    process.exitCode = 1;
    return null;
  }
  if (outcome.kind === 'unknown') {
    const check = n.unknownCheck(found.title, found.name, result.note, options);
    n.printJson({
      ...result,
      error: `The outcome of the create of the Ops task is not known (${n.opsText(args)}): ${made.error || 'the output has no id'}. The note stays. ${check.text}`,
      next: check.next,
      ifFound: check.ifFound,
    });
    process.exitCode = 1;
    return null;
  }
  const { id } = outcome;
  let address = typeof made.json.address === 'string' ? made.json.address : null;
  if (!address) {
    // The write is done, but the read of its address failed. Never create a second Ops task: read it again.
    try {
      address = n.showTask(root, id, options.org).address;
    } catch (error) {
      if (!(error instanceof TaskError)) throw error;
      n.printJson({ ...result, opsId: id, error: `The Ops task ${id} exists, but its address cannot be read: ${error.message}`, next: recovery(found.title, options, placement, id) });
      process.exitCode = 1;
      return null;
    }
  }

  // 4. The note gets the Ops address, the session stamp, and a Task Log line.
  writeOps(root, found.file, address, 'Created with the Ops task');
  result.ops = address;
  n.printJson(result);
  return null;
});
