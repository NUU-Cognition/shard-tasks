#!/usr/bin/env node
// The shared code of the task note scripts of the Tasks shard (Task 1291, contract N6): task-new, task-link, and
// task-sync. It is a module, not a command.
//
// A task of the Tasks shard has two parts, linked both ways:
// - the task note in the Flint (Mesh/Types/Tasks/(Task) <n> <title>.md, the template tmp-proj-task-v0.2), which holds
//   the content and the field `ops` (the address of the Ops task);
// - the Ops task, which holds the state and the field `note` (the address of the task note).
// Ops owns the status, the stage, and the outcome. task-sync copies them into the note, in one direction only.
//
// The rules:
// - Node built-ins only. The note edits use task-lib (the copy of the Projects task-lib): a lock for each note, no
//   symbolic link, and the strict YAML subset. Each Ops call and each flint call runs before the lock of the note.
// - `<ops>` is NUU_OPS_CLI, default `ops`. A value that names a file runs that file; another value runs in /bin/sh
//   with the arguments after it (the rule of `flint orbh task`).
// - An output never shows the value of NUU_OPS_CLI, and never shows the raw output of `<ops>`: a launcher in the shell
//   form can hold a credential. A failure of `<ops>` gives the code, the message, and the hints of its JSON error
//   document; with NUU_OPS_CLI in the shell form, only the code. In the shell form, the message text of an error or a
//   refusal also loses each literal occurrence of the value (see scrub). Data (an address, an id, a command) is never
//   changed. A value with a space at its start or its end is a refusal.
// - A command to run in an output is a shard script command (the scripts read NUU_OPS_CLI), or an `<ops>` step that
//   names $NUU_OPS_CLI (see opsStep). The name of `<ops>` in a description (see opsLabel) is not a command.
// - A script never runs an Ops write two times. When a read after a write fails, the output names the read to run.
//   When the outcome of a create is not known, the output names a check before a second create.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// The shared code: task-lib.js in the shard, dev-task-lib.js in the source.
const lib = require(fs.existsSync(path.join(__dirname, 'task-lib.js')) ? './task-lib.js' : './dev-task-lib.js');

const { TaskError } = lib;

/** The longest time of one Ops call or flint call. */
const CALL_TIMEOUT_MS = 60000;

/** A UUID (the `id` of a note). */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
/** The note address of N1: `@v1/<org>/task/<note id>#flint/<flint>`, with an org. */
const NOTE_ADDRESS = new RegExp(`^@v1/[^/#\\s]+/task/${UUID}#flint/[^/#\\s]+$`, 'i');
/** An Ops task address: `@v1/<org>/task/<id>#ops` or `@v1/<org>/task.<subtype>/<id>#ops`. */
const OPS_ADDRESS = /^@v1\/[^/#\s]+\/task(?:\.[a-z][a-z0-9]*)?\/[^/#\s]+#ops$/;
/** The title of a task note: `(Task) <n> <name>`. */
const NOTE_TITLE = /^\(Task\) (\d+) (.+)$/;

/** The placement options of `ops task create`. With none of them, task-new and task-link pass --unplaced. */
const PLACEMENT = ['unplaced', 'subsection', 'project', 'folder', 'master'];

// ---------------------------------------------------------------------------
// The arguments

/**
 * Parse the arguments: the positionals, the options with a value (`spec.values`), and the flags (`spec.flags`).
 * `--name=value` works too. An unknown option or a missing value is a refusal.
 */
function parseArgs(argv, spec) {
  const values = new Set(spec.values || []);
  const flags = new Set(spec.flags || []);
  const positional = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      positional.push(...argv.slice(index + 1));
      break;
    }
    if (!arg.startsWith('--') || arg === '-') {
      positional.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    const name = arg.slice(2, eq < 0 ? undefined : eq);
    if (flags.has(name)) {
      if (eq >= 0) throw new TaskError(`--${name} takes no value. Nothing changed.`);
      options[name] = true;
      continue;
    }
    if (!values.has(name)) throw new TaskError(`Unknown option --${name}. ${spec.usage} Nothing changed.`);
    let value;
    if (eq >= 0) value = arg.slice(eq + 1);
    else {
      value = argv[index + 1];
      index += 1;
    }
    if (value === undefined || value.trim() === '') throw new TaskError(`--${name} needs a value. Nothing changed.`);
    if (options[name] !== undefined) throw new TaskError(`--${name} is given two times. Nothing changed.`);
    options[name] = value.trim();
  }
  return { positional, options };
}

/** The Flint root: FLINT_ROOT, else the working folder. */
function flintRoot() {
  return path.resolve(process.env.FLINT_ROOT || process.cwd());
}

// ---------------------------------------------------------------------------
// The commands: flint and <ops>

/** The text of a failed call: the error message of its JSON, else its last line. */
function failureText(result, fallback) {
  for (const output of [result.stderr, result.stdout]) {
    const text = (output || '').trim();
    if (!text.startsWith('{')) continue;
    try {
      const json = JSON.parse(text);
      const error = json && typeof json.error === 'object' && json.error !== null ? json.error : json;
      const code = typeof error.code === 'string' ? error.code : '';
      const message = typeof error.message === 'string' ? error.message : typeof error.reason === 'string' ? error.reason : '';
      if (message) return code && !message.includes(code) ? `${code}: ${message}` : message;
    } catch {
      // Not one JSON document: use the lines below.
    }
  }
  if (result.error) return result.error.message;
  const lines = `${result.stderr || ''}\n${result.stdout || ''}`.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.at(-1) || fallback;
}

/** Run a program with a time limit. It never throws: the result of spawnSync. */
function spawn(file, args, root) {
  // SIGKILL: a child that ignores SIGTERM must not outlive the timeout.
  return spawnSync(file, args, {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: CALL_TIMEOUT_MS,
    killSignal: 'SIGKILL',
  });
}

/** The parsed stdout of a run, or null. */
function stdoutJson(result) {
  try {
    return JSON.parse((result.stdout || '').trim());
  } catch {
    return null;
  }
}

/** Run a command (flint). It never throws: `{ ok, json, stdout, stderr, error }`. `json` is the parsed stdout. */
function call(file, args, root) {
  const result = spawn(file, args, root);
  const ok = !result.error && result.status === 0;
  return { ok, json: stdoutJson(result), stdout: result.stdout || '', stderr: result.stderr || '', error: ok ? null : failureText(result, `exit ${result.status}`) };
}

/**
 * The command of `<ops>`: NUU_OPS_CLI, default `ops`. The value is not trimmed, because a step in a message names
 * "$NUU_OPS_CLI" as it is: a value with a space at its start or its end is a refusal.
 */
function opsCommand() {
  const value = process.env.NUU_OPS_CLI || '';
  if (value === '') return 'ops';
  if (value !== value.trim()) {
    throw new TaskError('NUU_OPS_CLI has a space at its start or its end. Remove the spaces and run the command again. Nothing changed.');
  }
  return value;
}

/** True when NUU_OPS_CLI is set and is not the path of one file: the shell form, which can hold a credential. */
function shellForm() {
  return (process.env.NUU_OPS_CLI || '') !== '' && !namesFile(opsCommand());
}

/**
 * The message text of an error or a refusal, with each literal occurrence of the value of NUU_OPS_CLI replaced by
 * `<NUU_OPS_CLI>`. Only for message text, never for data. Only in the shell form, and only for a value with a space
 * or an `=` (an argument or an assignment can hold a credential). A file path, or one word such as `ops`, is no
 * secret, and a word such as `ops` is also a part of the data (`#ops`, `--ops`): such a text does not change.
 */
function scrub(text) {
  const value = process.env.NUU_OPS_CLI || '';
  if (!/[\s=]/.test(value) || !shellForm()) return String(text);
  return String(text).split(value).join('<NUU_OPS_CLI>');
}

/** True when the command of `<ops>` names a file (the file form of NUU_OPS_CLI), not a command for /bin/sh. */
function namesFile(command) {
  try {
    return command.includes('/') && fs.statSync(command).isFile();
  } catch {
    return false;
  }
}

/**
 * The JSON error document of a failed `<ops> … --json`: exactly one document `{ error: { code, message, hints?,
 * exitCode?, status? } }` on stderr. Returns `{ code, message, hints, exitCode, status }`, or null when the stderr is not
 * that document (for example a /bin/sh error, or a launcher that fails before ops runs).
 */
function opsReport(stderr) {
  const text = String(stderr || '').trim();
  // The document is the whole stderr. A warning line before it is allowed: then the document starts on a line "{".
  const start = text.startsWith('{') ? 0 : text.lastIndexOf('\n{') + 1;
  if (start === 0 && !text.startsWith('{')) return null;
  let doc;
  try {
    doc = JSON.parse(text.slice(start));
  } catch {
    return null;
  }
  const error = doc && typeof doc === 'object' && doc.error && typeof doc.error === 'object' ? doc.error : null;
  if (!error || typeof error.code !== 'string' || typeof error.message !== 'string') return null;
  return {
    code: error.code,
    message: error.message,
    hints: Array.isArray(error.hints) ? error.hints.filter((hint) => typeof hint === 'string' && hint.trim() !== '') : [],
    exitCode: typeof error.exitCode === 'number' ? error.exitCode : null,
    status: typeof error.status === 'number' ? error.status : null,
  };
}

/**
 * The text of a failed `<ops>` call: the code, the message, and the hints of its JSON error, else a fixed text. With
 * NUU_OPS_CLI in the shell form, only the code: a message or a hint can repeat the launcher and its credential.
 */
function opsFailureText(result, report) {
  if (report && shellForm()) return `${report.code}: run the ops step by hand to see the message`;
  if (report) {
    const head = (report.message.includes(report.code) ? report.message : `${report.code}: ${report.message}`).replace(/[.\s]+$/, '');
    if (report.hints.length === 0) return head;
    const mark = process.env.NUU_OPS_CLI ? ' (in a hint, ops is the ops of NUU_OPS_CLI)' : '';
    return `${head}. Hints of ops${mark}: ${report.hints.join(' ')}`.replace(/[.\s]+$/, '');
  }
  if (result.error && result.error.code === 'ETIMEDOUT') return `the ops command did not finish in ${CALL_TIMEOUT_MS / 1000} s, and it was stopped`;
  if (result.error) return `the ops command did not start (${result.error.code || 'error'})`;
  if (result.status === null) return `the ops command stopped on the signal ${result.signal} before it gave a JSON error`;
  return `the ops command failed (exit ${result.status}) before it gave a JSON error; run it by hand to see the error`;
}

/**
 * Run `<ops> <args>`. A value of NUU_OPS_CLI that names a file runs that file; another value runs in /bin/sh. It never
 * throws: `{ ok, json, error, report }`. The raw output is not in the result, so that no message can show it.
 */
function runOps(args, root) {
  const command = opsCommand();
  const result = namesFile(command) ? spawn(command, args, root) : spawn('/bin/sh', ['-c', `${command} "$@"`, 'sh', ...args], root);
  const ok = !result.error && result.status === 0;
  if (ok) return { ok, json: stdoutJson(result), error: null, report: null };
  const report = opsReport(result.stderr);
  return { ok, json: stdoutJson(result), error: opsFailureText(result, report), report };
}

/** A failed create that reports its task: `Created task <id>, but <part> failed: <reason>` (stepAfterCreate of ops). */
const CREATED_BUT = /^Created task ([A-Za-z0-9_-]+), but (.+?) failed: ([\s\S]*)$/;

/**
 * The codes that ops gives before any write of `task create`. The HTTP status is not used: the CLI gives
 * `bad_response` with a status 4xx for a body that is not JSON, also after a commit.
 * - The CLI (apps/cli-ops/src): a usage error, no login, a route of a subsection, and the refs that do not resolve
 *   (refs.ts `<kind>_not_found` and `<kind>_ambiguous`, the org, and the member).
 * - The gateway before the mutation (apps/nuu-ops/convex/agentApi.ts dispatchAgentRequest), and the org access.
 * - The refusals of the mutation tasks.create (apps/nuu-ops/convex/tasks.ts createTask): a ConvexError in a JSON
 *   envelope, and the mutation is one transaction.
 */
const REFUSAL_CODES = new Set([
  'usage', 'auth_required', 'unauthenticated', 'subsection_route_unknown',
  'agent_invalid_input', 'agent_unknown_operation', 'agent_wrong_endpoint', 'agent_mark_unsupported', 'fleet_actor_invalid',
  'org_unauthorized', 'org_frozen',
  'task_note_invalid', 'task_body_too_large', 'task_field_invalid', 'task_type_unknown', 'task_unplaced_with_home',
  'task_folder_in_subsection', 'task_subsection_required', 'task_deliverable_required', 'task_project_required',
  'task_project_mismatch', 'deliverable_project_mismatch', 'invalid_rarity', 'subsection_blocked', 'task_stage_unknown',
  'task_stage_forbidden',
]);
const REFUSAL_REF = /^(?:org|member|user|record|project|deliverable|subsection|backlog_folder|task|task_group)_(?:not_found|ambiguous)$/;

/**
 * True when the JSON error of `<ops>` is a refusal before any write: a code of REFUSAL_CODES or REFUSAL_REF. Each other
 * failure (bad_response, agent_error, network, an HTTP status 5xx, an unknown code, no JSON error) is not a refusal:
 * the write can be done.
 */
function refusedBeforeWrite(report) {
  if (!report) return false;
  return REFUSAL_CODES.has(report.code) || REFUSAL_REF.test(report.code);
}

/**
 * The outcome of `<ops> task create … --json`: `{ kind: 'done', id }`; `{ kind: 'created', id, part, reason }` (the
 * task exists, but a step after the create failed); `{ kind: 'refused' }` (no write); or `{ kind: 'unknown' }` (the
 * task can exist: check before a second create).
 */
function createOutcome(made) {
  const id = made.json && typeof made.json.id === 'string' && made.json.id ? made.json.id : null;
  if (made.ok && id) return { kind: 'done', id };
  const match = made.report ? CREATED_BUT.exec(made.report.message) : null;
  if (match) return { kind: 'created', id: match[1], part: match[2], reason: match[3].replace(/[.\s]+$/, '') };
  if (!made.ok && refusedBeforeWrite(made.report)) return { kind: 'refused' };
  return { kind: 'unknown' };
}

/**
 * The name of `<ops>` in a description of a call: the base name of the file when NUU_OPS_CLI names a file, else `ops`.
 * It is a display name, not a command (see opsStep). A message never shows the value of NUU_OPS_CLI: a value in the
 * shell form can hold a credential (`env TOKEN=… <path>`).
 */
function opsLabel() {
  const command = opsCommand();
  const label = namesFile(command) ? path.basename(command) : 'ops';
  return /^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(label) ? label : 'ops';
}

/** One word for a POSIX shell: a plain word stays, another word goes in single quotes (with ' as '\''). */
function shellQuote(word) {
  const text = String(word);
  return /^[A-Za-z0-9@%+,./:=_-]+$/.test(text) ? text : `'${text.replace(/'/g, `'\\''`)}'`;
}

/** A command for a message or a `next` field: each word quoted for a POSIX shell. */
function shellCommand(words) {
  return words.map(shellQuote).join(' ');
}

/** The description of an `<ops>` call in a message: the display name (see opsLabel), and the quoted arguments. */
function opsText(args) {
  return [opsLabel(), ...args.map(shellQuote)].join(' ');
}

/**
 * An `<ops>` step to run in a POSIX shell. It runs the ops that the scripts run, and it names $NUU_OPS_CLI, not its
 * value: `ops <args>` when NUU_OPS_CLI is not set, `"$NUU_OPS_CLI" <args>` for a file, else
 * `sh -c "$NUU_OPS_CLI"' "$@"' sh <args>` (the shell form, as runOps runs it). Run it with the same NUU_OPS_CLI.
 */
function opsStep(args) {
  const quoted = args.map(shellQuote).join(' ');
  if (!process.env.NUU_OPS_CLI) return `ops ${quoted}`;
  if (namesFile(opsCommand())) return `"$NUU_OPS_CLI" ${quoted}`;
  return `sh -c "$NUU_OPS_CLI"' "$@"' sh ${quoted}`;
}

/** The words before an `<ops>` step in a message: they say which ops runs it. */
function opsStepLead() {
  return process.env.NUU_OPS_CLI ? 'with the ops of NUU_OPS_CLI (the same value as for this script)' : 'with ops';
}

/** Run `flint <args>`, and give its JSON. A failure is a refusal with the reason. */
function flintJson(args, root, what) {
  const result = call('flint', args, root);
  if (!result.ok || result.json === null) {
    throw new TaskError(`${what} failed (${shellCommand(['flint', ...args])}): ${result.error || 'the output is not JSON'}.`);
  }
  return result.json;
}

// ---------------------------------------------------------------------------
// The Flint and the note

/** The name and the org of this Flint, from `flint org show --json`. A local Flint (no org) is a refusal. */
function flintInfo(root) {
  const json = flintJson(['org', 'show', '--json'], root, 'The read of the Flint');
  const name = json && json.flint && typeof json.flint.name === 'string' ? json.flint.name.trim() : '';
  const org = json && json.org && typeof json.org.slug === 'string' ? json.org.slug.trim() : '';
  if (!name) throw new TaskError('flint org show --json gives no name of the Flint. Nothing changed.');
  if (!org) {
    throw new TaskError('This Flint has no org, so the address of a task note is local (@v1//…), and Ops refuses it. Give the Flint an org first: flint org set <org>. Nothing changed.');
  }
  return { name, org };
}

/** The number and the name of a task note title: `(Task) 1291 Title` gives `{ number: '1291', name: 'Title' }`. */
function noteTitle(title) {
  const match = NOTE_TITLE.exec(title);
  if (!match) throw new TaskError(`"${title}" is not the title of a task note: "(Task) <n> <title>". Nothing changed.`);
  return { number: match[1], name: match[2].trim() };
}

/** The label of a note (N1): `Task <n> · <Flint name>`. */
function noteLabel(number, flintName) {
  return `Task ${number} · ${flintName}`;
}

/** The note address of a task number, from `flint resolve @v1//task/<n> --json` (the field `address`). */
function noteAddress(root, number, file) {
  const json = flintJson(['resolve', `@v1//task/${number}`, '--json'], root, `The resolve of task ${number}`);
  const address = json && typeof json.address === 'string' ? json.address.trim() : '';
  if (!NOTE_ADDRESS.test(address)) {
    throw new TaskError(`flint resolve @v1//task/${number} gives "${address}", not a note address @v1/<org>/task/<note id>#flint/<flint>.`);
  }
  // The resolve must name this note: its key is the id of the frontmatter.
  if (file) {
    const id = readNote(root, file).id;
    if (!id || !address.toLowerCase().includes(`/task/${id.toLowerCase()}#`)) {
      throw new TaskError(`flint resolve @v1//task/${number} gives ${address}, but the id of ${path.relative(root, file)} is "${id}". Nothing changed.`);
    }
  }
  return address;
}

/** Find a task note by its title, a wikilink, or a path. */
function findNote(root, ref) {
  const { title, file } = lib.findMeshFile(root, ref, 'task');
  return { title, file, ...noteTitle(title) };
}

/**
 * The task note of a ref: a title, a wikilink, or a path of a note; or an Ops task (an address `…#ops`), whose field
 * `note` names the note. A note of another Flint is a refusal.
 */
function findNoteOf(root, ref) {
  const text = String(ref || '').trim();
  if (!OPS_ADDRESS.test(text)) return findNote(root, text);
  const shown = showTask(root, text);
  const note = opsNote(shown);
  if (!note) {
    throw new TaskError(`The Ops task ${shown.address} has no task note. Make one: ${shellCommand(['flint', 'shard', 'task', 'task-new', '--ops', shown.address])}. Nothing changed.`);
  }
  const json = flintJson(['resolve', note, '--json'], root, `The resolve of the note ${note}`);
  const presences = json && json.response && Array.isArray(json.response.presences) ? json.response.presences : [];
  // Compare real paths: the resolve can give /private/tmp/… for a root of /tmp/….
  const realRoot = fs.realpathSync(root);
  const real = (candidate) => {
    try {
      return fs.realpathSync(candidate);
    } catch {
      return '';
    }
  };
  const file = presences.map((presence) => (presence && typeof presence.path === 'string' ? real(presence.path) : '')).find((candidate) => {
    const relative = candidate ? path.relative(realRoot, candidate) : '';
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
  });
  if (!file) throw new TaskError(`The note ${note} of ${shown.address} is not a file of this Flint. Nothing changed.`);
  return findNote(root, path.basename(file));
}

/** Read the fields of a note that the scripts use. */
function readNote(root, file) {
  const doc = lib.readDoc(root, file, 'task');
  return {
    id: lib.getScalar(doc, 'id'),
    ops: lib.getScalar(doc, 'ops'),
    type: lib.getScalar(doc, 'task-type'),
    stage: lib.getScalar(doc, 'stage'),
    status: lib.getScalar(doc, 'status'),
    completed: lib.getScalar(doc, 'completed'),
  };
}

/** The keys after which a new field of the note goes, in order of preference. */
const FIELD_AFTER = {
  ops: ['priority', 'completed', 'status'],
  'task-type': ['ops', 'priority', 'completed', 'status'],
  stage: ['task-type', 'ops', 'priority', 'completed', 'status'],
  status: ['tags'],
  completed: ['due', 'from', 'status'],
};

/**
 * Set a scalar field of the note. An empty value clears a present field (`key:` with no value) and adds no new field.
 * A value that is not a plain word goes in double quotes. Returns true when the line changed.
 */
function setField(doc, key, value) {
  const current = lib.getScalar(doc, key);
  const next = value === null || value === undefined ? '' : String(value);
  if (current === next) return false;
  if (next === '') {
    const field = doc.fm.fields.get(key);
    if (!field) return false;
    lib.replaceLine(doc, field.start, `${key}:`);
    return true;
  }
  const text = /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(next) ? next : lib.quoteLike('"', next);
  lib.setScalar(doc, key, text, FIELD_AFTER[key] || []);
  return true;
}

// ---------------------------------------------------------------------------
// The Ops task

/** The placement arguments of `ops task create`. With no placement option, the task is unplaced. */
function placementArgs(options) {
  const args = [];
  if (options.unplaced) args.push('--unplaced');
  if (options.subsection) args.push('--subsection', options.subsection);
  if (options.project) args.push('--project', options.project);
  if (options.folder) args.push('--folder', options.folder);
  if (options.master) args.push('--master');
  if (options.unplaced && args.length > 1) throw new TaskError('--unplaced takes no other placement option. Nothing changed.');
  if (args.length === 0) args.push('--unplaced');
  return args;
}

/** Read an Ops task: `<ops> task show <ref> --json`. A failure is a refusal with the reason. */
function showTask(root, ref, org) {
  const args = ['task', 'show', ref, ...(org ? ['--org', org] : []), '--json'];
  const result = runOps(args, root);
  if (!result.ok || !result.json || typeof result.json !== 'object') {
    throw new TaskError(`The read of the Ops task failed (${opsText(args)}): ${result.error || 'the output is not JSON'}.`);
  }
  const task = result.json.task && typeof result.json.task === 'object' ? result.json.task : {};
  const address = typeof result.json.address === 'string' ? result.json.address : typeof task.address === 'string' ? task.address : '';
  if (!OPS_ADDRESS.test(address)) throw new TaskError(`${opsText(args)} gives no Ops task address. Nothing changed.`);
  return { address, task, json: result.json };
}

/** The note address that an Ops task holds (`note` of `ops task show --json`, at the top or in `task`), or ''. */
function opsNote(shown) {
  for (const value of [shown.json.note, shown.task.note]) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return '';
}

/**
 * The flag blocked of an Ops task. Ops gives an object (`{ reason, next?, at }`) for a blocked task, and no value for
 * a task that is not blocked. Each value that is set (not null, not false) is the flag.
 */
function isBlocked(task) {
  return task.blocked !== undefined && task.blocked !== null && task.blocked !== false;
}

/**
 * The note status of an Ops task (N6): todo → todo; doing → in-progress; an open task (todo or doing) with the flag
 * blocked → blocked; done with the outcome completed (or no outcome) → done, dropped → deprecated, superseded →
 * superseded.
 */
function noteStatus(task) {
  const checkbox = task.checkbox;
  if ((checkbox === 'todo' || checkbox === 'doing') && isBlocked(task)) return 'blocked';
  if (checkbox === 'todo') return 'todo';
  if (checkbox === 'doing') return 'in-progress';
  if (checkbox === 'done') {
    if (task.outcome === 'dropped') return 'deprecated';
    if (task.outcome === 'superseded') return 'superseded';
    return 'done';
  }
  throw new TaskError(`The Ops task has the status "${checkbox}", not todo, doing, or done. Nothing changed.`);
}

/**
 * The message of a create that made the task but failed after it (createOutcome kind `created`): the task, the part
 * that failed, and the step for that part. The task has the note already, because the create had --note.
 */
function createdText(outcome, made, repo, orgArgs) {
  // The part is a fixed phrase of stepAfterCreate; the reason is a message of ops (none in the shell form, see E4).
  const repoPart = outcome.part === 'the repo related link';
  const part = repoPart || outcome.part === 'the move to the top of its bucket' ? outcome.part : 'a step after the create';
  const why = shellForm() ? ` (${made.report.code}: run the ops step by hand to see the message)` : `: ${outcome.reason}`;
  const head = `The Ops task ${outcome.id} exists with this note, but ${part} failed${why}. Do not create it again.`;
  if (repoPart && repo) {
    return `${head} After the link, add the repo link ${opsStepLead()}: ${opsStep(['task', 'relate', outcome.id, 'repo', repo, ...orgArgs])}.`;
  }
  const hints = !shellForm() && made.report.hints.length > 0 ? ` The hints of ops (ops is the ops of NUU_OPS_CLI): ${made.report.hints.join(' ')}` : '';
  return `${head} After the link, do the failed part by hand.${hints}`;
}

/**
 * The org of a create: --org, else the org of an address of the placement (--project or --subsection), else the
 * active org of ops. Returns `{ args, name }`: the --org arguments of a step, and the name of the org for a message.
 */
function createOrg(options) {
  if (options.org) return { args: ['--org', options.org], name: `the org ${options.org}` };
  for (const ref of [options.project, options.subsection]) {
    const match = /^@v1\/([^/#\s]+)\//.exec(String(ref || ''));
    if (match) return { args: ['--org', match[1]], name: `the org ${match[1]}` };
  }
  return { args: [], name: 'the active org of ops (ops whoami)' };
}

/**
 * The check when the outcome of a create is not known (createOutcome kind `unknown`). It gives no create command:
 * a search cannot prove that no task exists. Returns `{ next, ifFound, text }`: next is the search in the org of the
 * create, ifFound is task-link --ops <id> (`<id>` is a place holder), and text says what to do. With `inline`, the
 * text has the two commands in it (for a refusal on stderr); else it names the keys next and ifFound.
 */
function unknownCheck(title, name, note, options, inline) {
  const org = createOrg(options);
  // Ops stores a title with a last digit 0 to 7 (the rarity) with no digit: search with no digit.
  const match = /^(.*?)\s+[0-7]$/.exec(name);
  const query = match && match[1].trimEnd() !== '' ? match[1].trimEnd() : name;
  const orgText = org.args.length > 0 ? ` ${shellCommand(org.args)}` : '';
  const next = opsStep(['task', 'search', query, ...org.args, '--json']);
  const ifFound = `${shellCommand(['flint', 'shard', 'task', 'task-link', title])} --ops <id>${orgText}`;
  const search = inline ? `Search in ${org.name} ${opsStepLead()}: ${next}.` : `next is a search in ${org.name}: run it ${opsStepLead()}.`;
  const found = inline ? `link it: ${ifFound}` : 'run ifFound with its id';
  return {
    next,
    ifFound,
    text: `The Ops task can exist. ${search} A search can miss the task: Ops can store another title, the search has a limit, and the rows of a search have no note. Read the note of each task of the search: ${opsStep(['task', 'show'])} <id>${orgText} --json. The task with the note ${note} is the task of this note: ${found}. Do not create the task again until a person or the agent has checked the Ops tasks of ${org.name.replace(/ \(ops whoami\)$/, '')} by hand; then use the command of task-link with the create options.`,
  };
}

/** A date of Ops (milliseconds) as the local date YYYY-MM-DD, or today. */
function dateOf(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return lib.today();
  const date = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The state of an Ops task as the fields of its note (N6): `ops` (the current address), `status`, `stage` and
 * `task-type` (empty for an untyped task), and `completed` (the date of the close when the task is done, else empty).
 * An unknown status is a refusal: compute the state before any write.
 */
function opsState(shown) {
  const task = shown.task;
  const typed = typeof task.type === 'string' && task.type !== '' && task.type !== 'task';
  return {
    ops: shown.address,
    status: noteStatus(task),
    stage: typed && typeof task.stage === 'string' ? task.stage : '',
    'task-type': typed ? task.type : '',
    completed: task.checkbox === 'done' ? dateOf(task.completedAt) : '',
  };
}

/**
 * Write the state of an Ops task (from opsState) into a note that is open under its lock. A completed date that a
 * person wrote stays while the task is done. A change of the status or the stage adds one Task Log line. Returns the
 * fields that changed. `state` gets the values that the note has after the write.
 */
function writeState(doc, state, script) {
  const old = { status: lib.getScalar(doc, 'status'), stage: lib.getScalar(doc, 'stage') };
  if (state.completed !== '' && lib.getScalar(doc, 'completed') !== '') state.completed = lib.getScalar(doc, 'completed');
  const fields = ['ops', 'status', 'task-type', 'stage', 'completed'].filter((key) => setField(doc, key, state[key]));
  if (fields.includes('status') || fields.includes('stage')) {
    const parts = [];
    if (fields.includes('status')) parts.push(`status ${old.status || 'none'} → ${state.status}`);
    if (fields.includes('stage')) parts.push(`stage ${old.stage || 'none'} → ${state.stage || 'none'}`);
    lib.appendTaskLog(doc, `- ${lib.today()}: Ops state: ${parts.join(', ')} (${provenance(script)}).`);
  }
  return fields;
}

/** Write a temporary file in a new folder of its own. Returns `{ file, remove }`. */
function tempFile(name, text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-task-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, text, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  return {
    file,
    remove() {
      fs.rmSync(file, { force: true });
      fs.rmdirSync(dir);
    },
  };
}

/**
 * Print one JSON result on stdout. Only the field `error` is message text, and only it goes through scrub. Each other
 * field is data (an address, an id, a command), and it does not change.
 */
function printJson(value) {
  const out = value && typeof value.error === 'string' ? { ...value, error: scrub(value.error) } : value;
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}

/**
 * Run the main function of a script (lib.run). First it checks NUU_OPS_CLI, before any write. The message of a
 * refusal or of an error goes through scrub (the shell form only).
 */
function run(name, main) {
  lib.run(name, (argv) => {
    try {
      opsCommand();
      return main(argv);
    } catch (error) {
      throw new TaskError(scrub(error instanceof TaskError ? error.message : error && error.stack ? error.stack : String(error)));
    }
  });
}

/** The provenance of a log line: the script and the session. */
function provenance(script) {
  const session = process.env.ORBH_SESSION_ID;
  return session ? `script ${script}, session ${session}` : `script ${script}`;
}

module.exports = {
  lib,
  TaskError,
  NOTE_ADDRESS,
  OPS_ADDRESS,
  PLACEMENT,
  parseArgs,
  flintRoot,
  runOps,
  opsReport,
  createOutcome,
  refusedBeforeWrite,
  opsLabel,
  opsText,
  opsStep,
  opsStepLead,
  createdText,
  createOrg,
  unknownCheck,
  scrub,
  run,
  shellQuote,
  shellCommand,
  flintJson,
  flintInfo,
  noteTitle,
  noteLabel,
  noteAddress,
  findNote,
  findNoteOf,
  readNote,
  setField,
  placementArgs,
  showTask,
  opsNote,
  isBlocked,
  noteStatus,
  opsState,
  writeState,
  dateOf,
  tempFile,
  printJson,
  provenance,
};

if (require.main === module) {
  process.stderr.write('note-lib is the shared module of the Tasks shard scripts, not a command. Run: flint shard task task-new|task-link|task-sync\n');
  process.exitCode = 2;
}
