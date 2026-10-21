#!/usr/bin/env node
// The shared code of the scripts of the Tasks shard: task-new, task-link, and task-sync (Task 1291).
// A copy of scripts/dev-task-lib.js of the Projects shard 1.7.1 (commit a42457c of its source). The Tasks shard
// keeps its own copy, because a shard is a self-contained package. The changes to the copy: this header, the message
// of a run as a command, and the exports quoteLike, replaceLine, listField, and addListItem. Keep the other code the
// same as the Projects copy: a fix there goes here too.
// It is a module, not a command. The scripts require task-lib.js in the shard (the build strips "dev-" from each file
// name) and dev-task-lib.js in the source.
// The env of a behaviour run (NUU Orbh Task 743): FLINT_ROOT, FLINT_INVOCATION_ID, FLINT_BEHAVIOUR,
// FLINT_BEHAVIOUR_VALUE, FLINT_INVOCATION_INPUTS (a JSON object of the inputs), and ORBH_SESSION_ID.
// The task is the input "task": its title, for example "(Task) 743 Shard Invocations". The scripts find the file
// "<title>.md" under Mesh/.
//
// The edit rules (the decision of the manager in the review of Task 743):
// - Node built-ins only, no YAML library. The scripts edit a strict subset of YAML. They refuse every other form
//   before any write, with exit 1, "Nothing changed", and the line that is not in the subset.
// - The frontmatter starts at line 1 with "---" and ends at the next line that is exactly "---". A top-level key is an
//   unquoted name at column 0. Each search stays inside these two lines, and each edit parses the frontmatter again.
// - The fields that a script reads or writes (status, completed, from, orb, orbh-sessions) have the forms of
//   decodeScalar and listField. Every other line stays as it is, with its own line end.
// - The session stamp (NUU Orbh Mission 027): a new stamp goes into `orb:` as the v1 address of the session. The old
//   field `orbh-sessions` is read, never changed, and never removed. A script never parses a v1 address (R27): an
//   item is the stamp of this session only when it is exactly one of the forms of trackSession.
// - A script locks each document from the read to the replace (a folder under <FLINT_ROOT>/.flint/locks/), in the
//   order of the sorted real paths. It follows no symbolic link. It replaces a file only through a new temporary file
//   in the same folder.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

/** A refusal or a failure. `run` prints the message on stderr and exits 1. */
class TaskError extends Error {}

/** Today in the local time zone, ISO 8601 (YYYY-MM-DD). */
function today() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The env of the run. `argv` gives the task and the value when the env has none (a run by hand). */
function readEnv(argv) {
  const root = path.resolve(process.env.FLINT_ROOT || process.cwd());
  let inputs = {};
  const rawInputs = process.env.FLINT_INVOCATION_INPUTS;
  if (rawInputs !== undefined && rawInputs.trim() !== '') {
    try {
      inputs = JSON.parse(rawInputs);
    } catch (error) {
      throw new TaskError(`FLINT_INVOCATION_INPUTS is not valid JSON: ${error.message}`);
    }
    if (inputs === null || typeof inputs !== 'object' || Array.isArray(inputs)) {
      throw new TaskError('FLINT_INVOCATION_INPUTS must be a JSON object of the inputs.');
    }
  }
  const task = typeof inputs.task === 'string' && inputs.task.trim() !== '' ? inputs.task : argv[0];
  const value = process.env.FLINT_BEHAVIOUR_VALUE !== undefined ? process.env.FLINT_BEHAVIOUR_VALUE : argv[1];
  return {
    root,
    task: task === undefined ? null : task,
    value: value === undefined ? null : value,
    invocation: process.env.FLINT_INVOCATION_ID || null,
    behaviour: process.env.FLINT_BEHAVIOUR || null,
    session: process.env.ORBH_SESSION_ID || null,
  };
}

/** The title of a task reference: a title, a wikilink, or a path to the file. */
function titleOf(ref) {
  let title = String(ref).trim();
  const link = /^\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]$/.exec(title);
  if (link) title = link[1].trim();
  title = path.basename(title);
  if (title.endsWith('.md')) title = title.slice(0, -3);
  return title;
}

/** The short name for the result line: "(Task) 743" for "(Task) 743 Shard Invocations", else the title. */
function shortName(title) {
  const match = /^(\(Task\) \d+)\b/.exec(title);
  return match ? match[1] : title;
}

// ---------------------------------------------------------------------------
// Paths: no symbolic link, and nothing outside the real Flint root

function lstatOrNull(file) {
  try {
    return fs.lstatSync(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

/** The Mesh folder. A missing folder, a symbolic link, or another kind of file is a refusal. */
function meshDir(root) {
  const mesh = path.join(root, 'Mesh');
  const stat = lstatOrNull(mesh);
  if (!stat) throw new TaskError(`No Mesh/ folder under ${root}. Nothing changed.`);
  if (stat.isSymbolicLink()) throw new TaskError('Mesh/ is a symbolic link. The task scripts follow no link. Nothing changed.');
  if (!stat.isDirectory()) throw new TaskError('Mesh is not a folder. Nothing changed.');
  return mesh;
}

/**
 * Check the path from the Flint root to a file: each folder is a real folder (no symbolic link), the file is a
 * regular file, and its real path is inside the real Flint root. Returns the lstat of the file and the chain: the
 * dev and ino of the root and of each folder from the root to the folder of the file.
 */
function checkPath(root, file) {
  const relative = path.relative(root, file);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new TaskError(`${file} is not inside the Flint root ${root}. Nothing changed.`);
  }
  const rootStat = fs.statSync(root);
  const chain = [{ path: root, dev: rootStat.dev, ino: rootStat.ino, follow: true }];
  const parts = relative.split(path.sep);
  let current = root;
  let stat = null;
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    stat = lstatOrNull(current);
    const shown = path.relative(root, current);
    if (!stat) throw new TaskError(`${shown} does not exist. Nothing changed.`);
    if (stat.isSymbolicLink()) throw new TaskError(`${shown} is a symbolic link. The task scripts follow no link. Nothing changed.`);
    const last = index === parts.length - 1;
    if (last ? !stat.isFile() : !stat.isDirectory()) {
      throw new TaskError(`${shown} is not a ${last ? 'regular file' : 'folder'}. Nothing changed.`);
    }
    if (!last) chain.push({ path: current, dev: stat.dev, ino: stat.ino, follow: false });
  }
  const realRoot = fs.realpathSync(root);
  const realFile = fs.realpathSync(file);
  if (!realFile.startsWith(realRoot + path.sep)) {
    throw new TaskError(`${relative} is outside the real Flint root ${realRoot}. Nothing changed.`);
  }
  return { stat, chain, real: realFile };
}

/**
 * Check the chain of checkPath again: the root and each folder down to the folder of the file have the same dev and
 * ino, and no folder below the root is now a symbolic link. Throws when one changed.
 */
function checkChain(root, name, chain) {
  for (const part of chain) {
    let now = null;
    try {
      now = part.follow ? fs.statSync(part.path) : fs.lstatSync(part.path);
    } catch {
      now = null;
    }
    if (!now || (!part.follow && (now.isSymbolicLink() || !now.isDirectory())) || now.dev !== part.dev || now.ino !== part.ino) {
      const shown = path.relative(root, part.path) || 'the Flint root';
      throw new TaskError(`${shown} changed during the run (another folder or a symbolic link). ${name} is not written.`);
    }
  }
}

/** All regular files named `<title>.md` under the folder, in a stable order. A symbolic link is never followed. */
function findFiles(dir, fileName, found = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') findFiles(full, fileName, found);
    } else if (entry.isFile() && entry.name === fileName) {
      found.push(full);
    }
  }
  return found;
}

/** The one file of a Mesh title. Refuses a missing title, no file, and more than one file. */
function findMeshFile(root, ref, what) {
  if (ref === null || String(ref).trim() === '') {
    throw new TaskError(`The invocation has no ${what} input. Set it with: flint shard invocations set-input ${what}="(Task) NNN Title"`);
  }
  const title = titleOf(ref);
  const files = findFiles(meshDir(root), `${title}.md`);
  if (files.length === 0) throw new TaskError(`No file "${title}.md" under Mesh/. Nothing changed.`);
  if (files.length > 1) {
    const list = files.map((file) => path.relative(root, file)).join(', ');
    throw new TaskError(`More than one file "${title}.md" under Mesh/: ${list}. A Mesh title must be unique. Nothing changed.`);
  }
  checkPath(root, files[0]);
  return { title, file: files[0] };
}

/** The increment file of a title: `{ file, reason: null }`, or `{ file: null, reason }` when there is not one file. */
function findIncrement(root, increment) {
  const files = findFiles(meshDir(root), `${increment}.md`);
  if (files.length === 1) {
    checkPath(root, files[0]);
    return { file: files[0], reason: null };
  }
  return {
    file: null,
    reason: files.length === 0
      ? `the increment log needs a line: no file "${increment}.md" under Mesh/`
      : `the increment log needs a line: more than one file "${increment}.md" under Mesh/`,
  };
}

// ---------------------------------------------------------------------------
// Locks: one folder for each document under <FLINT_ROOT>/.flint/locks/

/** A lock whose owner process is gone (ESRCH on this host) is stale after this time. A live owner is never stale. */
const LOCK_STALE_MS = 10000;
/** A lock with no valid owner file (its holder died between the mkdir and the owner write) is stale after this time. */
const LOCK_ORPHAN_MS = 60000;
/** The longest wait for one lock. */
const LOCK_WAIT_MS = 15000;
const LOCK_OWNER_FILE = 'owner';

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** A real folder (no symbolic link). Made when it is missing. */
function realFolder(root, folder) {
  try {
    fs.mkdirSync(folder, { mode: 0o755 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const stat = fs.lstatSync(folder);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new TaskError(`${path.relative(root, folder)} is not a real folder. The task scripts follow no link. Nothing changed.`);
  }
  return folder;
}

/** False only on proof that no process has this pid on this machine (ESRCH). EPERM means that the process lives. */
function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== 'ESRCH';
  }
}

/** The owner of a lock folder ({ pid, token, host }), or null when the owner file is missing or not valid. */
function readOwner(dir) {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(dir, LOCK_OWNER_FILE), 'utf8'));
    if (value && Number.isInteger(value.pid) && typeof value.token === 'string' && value.token !== '' && typeof value.host === 'string') {
      return value;
    }
  } catch {
    // No owner file, or not valid.
  }
  return null;
}

/** One try to take the lock: an exclusive mkdir, then the owner file with the pid and a random token. */
function tryAcquire(dir, token, real) {
  try {
    fs.mkdirSync(dir, { mode: 0o700 });
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
  try {
    const owner = { pid: process.pid, token, host: os.hostname(), at: new Date().toISOString(), path: real };
    fs.writeFileSync(path.join(dir, LOCK_OWNER_FILE), JSON.stringify(owner), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    // This try has no owner file: remove its empty folder, so that no other run waits for it.
    try {
      fs.rmdirSync(dir);
    } catch {
      // Not empty: it is not the folder of this try.
    }
    if (error.code === 'EEXIST' || error.code === 'ENOENT') return false;
    throw error;
  }
  return true;
}

/**
 * Take over a stale lock. A lock is stale when its owner process is gone (the same host, ESRCH) and the lock is older
 * than LOCK_STALE_MS, or when it has no valid owner file and is older than LOCK_ORPHAN_MS. Age alone never makes a
 * lock with a live owner stale. The takeover reads the owner again just before the rename, renames the folder to a
 * unique name (only one run wins the rename), and checks that it moved the same folder (dev, ino, mtime) with the
 * same owner token. Else it puts the folder back.
 */
function reclaimStaleLock(dir) {
  const observed = lstatOrNull(dir);
  if (!observed) return 'gone';
  if (observed.isSymbolicLink() || !observed.isDirectory()) throw new TaskError(`The lock ${dir} is not a folder. Nothing changed.`);
  const owner = readOwner(dir);
  const age = Date.now() - observed.mtimeMs;
  const stale = owner ? owner.host === os.hostname() && age > LOCK_STALE_MS && !pidAlive(owner.pid) : age > LOCK_ORPHAN_MS;
  if (!stale) return 'not-stale';
  const again = readOwner(dir);
  if ((owner ? again?.token !== owner.token : again !== null)) return 'not-stale';
  const tomb = `${dir}.stale-${crypto.randomBytes(6).toString('hex')}`;
  try {
    fs.renameSync(dir, tomb);
  } catch (error) {
    if (error.code === 'ENOENT') return 'gone';
    throw error;
  }
  const moved = lstatOrNull(tomb);
  const movedOwner = moved ? readOwner(tomb) : null;
  const same = moved
    && moved.dev === observed.dev && moved.ino === observed.ino && moved.mtimeMs === observed.mtimeMs
    && (owner ? movedOwner?.token === owner.token : movedOwner === null);
  if (!same) {
    // A new lock came between the check and the rename: give it back.
    try {
      fs.renameSync(tomb, dir);
    } catch {
      throw new TaskError(`A lock takeover moved the live lock ${dir} of another run to ${tomb} and could not put it back. Nothing changed.`);
    }
    return 'not-stale';
  }
  fs.rmSync(tomb, { recursive: true, force: true });
  return 'reclaimed';
}

/** Release a lock only when its owner file has the token of this run. */
function releaseLock(lock) {
  const tomb = `${lock.dir}.release-${crypto.randomBytes(6).toString('hex')}`;
  let moved = false;
  for (let tries = 0; tries < LOCK_MOVED_TRIES && !moved; tries += 1) {
    try {
      fs.renameSync(lock.dir, tomb);
      moved = true;
    } catch (error) {
      // ENOENT: a takeover of another run can have moved the lock away for a moment. Else: nothing to release.
      if (error.code !== 'ENOENT') return;
      sleep(LOCK_MOVED_SLEEP_MS);
    }
  }
  if (!moved) return;
  if (readOwner(tomb)?.token !== lock.token) {
    // Not the lock of this run: put it back.
    try {
      fs.renameSync(tomb, lock.dir);
    } catch {
      // Nothing more to do: the fence of its owner refuses its write.
    }
    return;
  }
  fs.rmSync(tomb, { recursive: true, force: true });
}

/** The locks that this process holds now, by the real path of the document. writeDoc checks them (the fence). */
const heldLocks = new Map();

/** Take the lock of one document. Waits up to LOCK_WAIT_MS. */
function acquireLock(root, file, real) {
  const locks = realFolder(root, path.join(realFolder(root, path.join(root, '.flint')), 'locks'));
  const hash = crypto.createHash('sha256').update(real).digest('hex').slice(0, 32);
  const dir = path.join(locks, `task-doc-${hash}.lock`);
  const token = crypto.randomBytes(16).toString('hex');
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    if (tryAcquire(dir, token, real)) return { dir, token, real };
    const reclaimed = reclaimStaleLock(dir);
    if (reclaimed !== 'not-stale') continue;
    if (Date.now() > deadline) {
      const owner = readOwner(dir);
      throw new TaskError(`Another run edits ${path.relative(root, file)} (the lock ${path.relative(root, dir)} is held${owner ? ` by the process ${owner.pid}` : ''}). Run again later. Nothing changed.`);
    }
    sleep(25);
  }
}

/** The tries of the fence and of the release while a takeover of another run has moved the lock away for a moment. */
const LOCK_MOVED_TRIES = 50;
const LOCK_MOVED_SLEEP_MS = 10;

/**
 * The fence before a write: the lock of the document is still held by this run (the owner token). A takeover of
 * another run can move this lock away and put it back (reclaimStaleLock), so a missing owner file is read again for
 * up to LOCK_MOVED_TRIES * LOCK_MOVED_SLEEP_MS. Another token means that the lock is lost.
 */
function assertHeld(doc) {
  const lock = heldLocks.get(doc.real);
  if (!lock) throw new TaskError(`${doc.name} is not locked by this run. It is not written.`);
  for (let tries = 0; tries < LOCK_MOVED_TRIES; tries += 1) {
    const owner = readOwner(lock.dir);
    if (owner && owner.token === lock.token) return;
    if (owner) break;
    sleep(LOCK_MOVED_SLEEP_MS);
  }
  throw new TaskError(`The lock of ${doc.name} was lost. It is not written.`);
}

/** Run `fn` while this process holds the locks of the files, taken in the order of the sorted real paths. */
function withLocks(root, files, fn) {
  const byReal = new Map(files.map((file) => [fs.realpathSync(file), file]));
  const reals = [...byReal.keys()].sort();
  const held = [];
  try {
    for (const real of reals) {
      const lock = acquireLock(root, byReal.get(real), real);
      held.push(lock);
      heldLocks.set(real, lock);
    }
    return fn();
  } finally {
    for (const lock of held.reverse()) {
      heldLocks.delete(lock.real);
      releaseLock(lock);
    }
  }
}

// ---------------------------------------------------------------------------
// The document: the lines of a file, each with its own line end

function splitLines(text) {
  const lines = [];
  let start = 0;
  while (start < text.length) {
    const nl = text.indexOf('\n', start);
    if (nl < 0) {
      lines.push({ text: text.slice(start), eol: '' });
      break;
    }
    const crlf = nl > start && text[nl - 1] === '\r';
    lines.push({ text: text.slice(start, crlf ? nl - 1 : nl), eol: crlf ? '\r\n' : '\n' });
    start = nl + 1;
  }
  return lines;
}

/**
 * Read a document after checkPath, through a descriptor that follows no link and that is the same file (dev and ino).
 * `kind`: 'task' (the frontmatter is required and must be in the strict subset) or 'increment' (only the end of the
 * frontmatter is found, when there is one; the scripts do not edit it).
 */
function readDoc(root, file, kind) {
  const name = path.relative(root, file);
  const { stat, chain, real } = checkPath(root, file);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  let buffer;
  let fstat;
  try {
    fstat = fs.fstatSync(fd);
    if (!fstat.isFile() || fstat.dev !== stat.dev || fstat.ino !== stat.ino) {
      throw new TaskError(`${name} changed during the read. Nothing changed.`);
    }
    buffer = fs.readFileSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  let text = buffer.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(buffer)) throw new TaskError(`${name} is not valid UTF-8. Nothing changed.`);
  const bom = text.startsWith('﻿') ? '﻿' : '';
  text = text.slice(bom.length);
  const lines = splitLines(text);
  const doc = {
    root, file, name, kind, bom, lines, chain, real,
    eol: lines.length > 0 && lines[0].eol !== '' ? lines[0].eol : '\n',
    dev: fstat.dev, ino: fstat.ino, size: fstat.size, mtimeMs: fstat.mtimeMs, mode: fstat.mode,
    fm: null, changed: false,
  };
  parseDoc(doc);
  return doc;
}

/** Parse the frontmatter again. Each edit calls it, so each position is new. */
function parseDoc(doc) {
  if (doc.kind === 'task') {
    doc.fm = parseFrontmatter(doc);
    // Each restricted field is checked before the first edit, also when the script does not read it (P-12).
    for (const key of RESTRICTED_SCALARS) scalarField(doc, key);
    for (const key of SESSION_FIELDS) listField(doc, key);
    return;
  }
  doc.fm = null;
  if (doc.lines.length > 0 && doc.lines[0].text === '---') {
    const close = doc.lines.findIndex((line, index) => index > 0 && line.text === '---');
    if (close < 0) throw new TaskError(`${doc.name} has no end of the frontmatter: no second line "---". Nothing changed.`);
    doc.fm = { close, fields: new Map() };
  }
}

/** The index of the first body line. */
function bodyStart(doc) {
  return doc.fm ? doc.fm.close + 1 : 0;
}

/** Insert lines at an index. At the end of the file, the last new line keeps the old end of the file. */
function insertLines(doc, at, texts) {
  const rows = texts.map((text) => ({ text, eol: doc.eol }));
  const before = doc.lines[at - 1];
  if (at === doc.lines.length && before) {
    rows[rows.length - 1].eol = before.eol;
    before.eol = doc.eol;
  }
  doc.lines.splice(at, 0, ...rows);
  doc.changed = true;
  parseDoc(doc);
}

function replaceLine(doc, index, text) {
  if (doc.lines[index].text === text) return false;
  doc.lines[index].text = text;
  doc.changed = true;
  parseDoc(doc);
  return true;
}

/** Remove a temporary file of this run, only when it is the file that this run made. */
function removeTemp(temp, made) {
  const stat = lstatOrNull(temp);
  if (stat && stat.isFile() && (!made || (stat.dev === made.dev && stat.ino === made.ino))) fs.unlinkSync(temp);
}

/**
 * Replace the file with the new text: a new temporary file in the same folder (exclusive create, no link follow, a
 * random name), checked, then renamed over the file. The file must still be the file of the read (dev, ino, size,
 * mtime), and its path must still pass checkPath.
 */
function writeDoc(doc) {
  if (!doc.changed) return false;
  assertHeld(doc);
  const now = checkPath(doc.root, doc.file);
  if (now.real !== doc.real || now.stat.dev !== doc.dev || now.stat.ino !== doc.ino || now.stat.size !== doc.size || now.stat.mtimeMs !== doc.mtimeMs) {
    throw new TaskError(`${doc.name} changed during the run. It is not written.`);
  }
  checkChain(doc.root, doc.name, doc.chain);
  const data = Buffer.from(doc.bom + doc.lines.map((line) => line.text + line.eol).join(''), 'utf8');
  const temp = path.join(path.dirname(doc.file), `.${path.basename(doc.file)}.${crypto.randomBytes(8).toString('hex')}.tmp`);
  const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW;
  let fd;
  try {
    fd = fs.openSync(temp, flags, doc.mode & 0o777);
  } catch (error) {
    if (error.code === 'EEXIST' || error.code === 'ELOOP') {
      throw new TaskError(`The temporary path ${path.relative(doc.root, temp)} exists. ${doc.name} is not written.`);
    }
    throw error;
  }
  let made;
  try {
    let offset = 0;
    while (offset < data.length) offset += fs.writeSync(fd, data, offset, data.length - offset);
    fs.fsyncSync(fd);
    made = fs.fstatSync(fd);
  } catch (error) {
    fs.closeSync(fd);
    removeTemp(temp, null);
    throw error;
  }
  fs.closeSync(fd);
  try {
    const check = lstatOrNull(temp);
    if (!check || !check.isFile() || check.dev !== made.dev || check.ino !== made.ino || check.size !== data.length) {
      throw new TaskError(`The temporary file of ${doc.name} changed before the replace. It is not written.`);
    }
    const target = lstatOrNull(doc.file);
    if (!target || target.isSymbolicLink() || target.dev !== doc.dev || target.ino !== doc.ino) {
      throw new TaskError(`${doc.name} changed during the run. It is not written.`);
    }
    // The last checks before the rename: the lock (the fence) and each folder from the root to the file (P-05).
    // Known limit: Node has no openat or renameat, so a very small window stays between this check and the rename,
    // in which another process can swap a folder of the path.
    assertHeld(doc);
    checkChain(doc.root, doc.name, doc.chain);
  } catch (error) {
    removeTemp(temp, made);
    throw error;
  }
  fs.renameSync(temp, doc.file);
  Object.assign(doc, { dev: made.dev, ino: made.ino, size: made.size, mtimeMs: made.mtimeMs, changed: false });
  return true;
}

// ---------------------------------------------------------------------------
// The strict YAML subset of the frontmatter

const TOP_KEY = /^([A-Za-z_][A-Za-z0-9_-]*):(.*)$/;
/** The scalar fields that a script reads or writes. Their forms are checked in each task document. */
const RESTRICTED_SCALARS = ['status', 'completed', 'from'];
/** The session stamp fields: `orb` (v1 addresses, the field of each new stamp) and `orbh-sessions` (the old field). */
const ORB_FIELD = 'orb';
const LEGACY_ORB_FIELD = 'orbh-sessions';
const SESSION_FIELDS = [ORB_FIELD, LEGACY_ORB_FIELD];

function unsupported(doc, index, why) {
  const line = doc.lines[index] ? doc.lines[index].text : '';
  return new TaskError(`${doc.name}: frontmatter line ${index + 1} ${JSON.stringify(line)} is not in the YAML subset of the task scripts: ${why}. Edit the file by hand. Nothing changed.`);
}

/**
 * The top-level fields of the frontmatter. A key is an unquoted name at column 0. Its value continues on the lines
 * that start with a space or with "- ". A comment line at column 0 ends the field. Every other form is a refusal.
 */
function parseFrontmatter(doc) {
  const lines = doc.lines;
  if (lines.length === 0 || lines[0].text !== '---') {
    throw new TaskError(`${doc.name} has no frontmatter: the first line is not "---". Nothing changed.`);
  }
  const close = lines.findIndex((line, index) => index > 0 && line.text === '---');
  if (close < 0) throw new TaskError(`${doc.name} has no end of the frontmatter: no second line "---". Nothing changed.`);
  const fields = new Map();
  let current = null;
  for (let index = 1; index < close; index += 1) {
    const text = lines[index].text;
    if (text.trim() === '') continue;
    if (text.startsWith('#')) {
      current = null;
      continue;
    }
    const key = TOP_KEY.exec(text);
    if (key) {
      if (key[2] !== '' && !/^[ \t]/.test(key[2])) throw unsupported(doc, index, 'a key needs a space after the colon');
      if (fields.has(key[1])) throw unsupported(doc, index, `the key "${key[1]}" is in the frontmatter more than one time`);
      current = { key: key[1], start: index, end: index + 1, rest: key[2] };
      fields.set(key[1], current);
      continue;
    }
    if (text.startsWith(' ') || /^-(?:[ \t]|$)/.test(text)) {
      if (!current) throw unsupported(doc, index, 'an indented line or a list item with no key above it');
      current.end = index + 1;
      continue;
    }
    throw unsupported(doc, index, text.startsWith('"') || text.startsWith("'")
      ? 'a quoted key'
      : 'a top-level key must be an unquoted name at column 0');
  }
  return { close, fields };
}

/** A failure to decode a value. The caller turns it into a refusal with the line. */
class ValueError extends Error {}

const DOUBLE_ESCAPES = {
  '0': '\0', a: '\x07', b: '\b', t: '\t', '\t': '\t', n: '\n', v: '\v', f: '\f', r: '\r', e: '\x1b', ' ': ' ',
  '"': '"', '/': '/', '\\': '\\', N: '\u0085', _: ' ', L: ' ', P: ' ',
};
const HEX_ESCAPES = { x: 2, u: 4, U: 8 };

/** A double-quoted scalar that starts at index `from` of `s`: `{ value, end }` (end is after the closing quote). */
function readDouble(s, from) {
  let out = '';
  let index = from + 1;
  for (;;) {
    const c = s[index];
    if (c === undefined) throw new ValueError('a double-quoted value that does not end on its line');
    if (c === '"') return { value: out, end: index + 1 };
    if (c !== '\\') {
      out += c;
      index += 1;
      continue;
    }
    const e = s[index + 1];
    if (e !== undefined && Object.prototype.hasOwnProperty.call(DOUBLE_ESCAPES, e)) {
      out += DOUBLE_ESCAPES[e];
      index += 2;
      continue;
    }
    const width = e === undefined ? 0 : HEX_ESCAPES[e] || 0;
    const hex = s.slice(index + 2, index + 2 + width);
    if (width === 0 || hex.length !== width || !/^[0-9A-Fa-f]+$/.test(hex) || parseInt(hex, 16) > 0x10ffff) {
      throw new ValueError(`the escape "\\${e === undefined ? '' : e}${hex}" that the scripts do not decode`);
    }
    out += String.fromCodePoint(parseInt(hex, 16));
    index += 2 + width;
  }
}

/** A single-quoted scalar that starts at index `from` of `s` ('' is one quote): `{ value, end }`. */
function readSingle(s, from) {
  let out = '';
  let index = from + 1;
  for (;;) {
    const c = s[index];
    if (c === undefined) throw new ValueError('a single-quoted value that does not end on its line');
    if (c === "'" && s[index + 1] === "'") {
      out += "'";
      index += 2;
    } else if (c === "'") {
      return { value: out, end: index + 1 };
    } else {
      out += c;
      index += 1;
    }
  }
}

/**
 * Decode the value on one line: empty, a plain scalar, a double-quoted scalar, or a single-quoted scalar, each with
 * an optional trailing `# comment`. Returns `{ value, comment, quote, empty, blank }`: `empty` for no value or a YAML
 * null, `blank` for no text but a comment. A block scalar, a list or a map, an anchor, an alias, or a tag is a
 * ValueError.
 */
function decodeScalar(rest) {
  const s = rest.replace(/^[ \t]+/, '');
  if (s === '' || s.startsWith('#')) return { value: '', comment: s, quote: '', empty: true, blank: true };
  let read = null;
  if (s[0] === '"') read = readDouble(s, 0);
  if (s[0] === "'") read = readSingle(s, 0);
  if (read) {
    const tail = s.slice(read.end);
    if (!/^(?:[ \t]*|[ \t]+#.*)$/.test(tail)) throw new ValueError(`text after the quoted value: ${JSON.stringify(tail)}`);
    return { value: read.value, comment: tail.trim(), quote: s[0], empty: false, blank: false };
  }
  if (s[0] === '|' || s[0] === '>') throw new ValueError('a block scalar');
  if (s[0] === '[' || s[0] === '{') throw new ValueError('a list or a map on one line');
  if (s[0] === '&' || s[0] === '*') throw new ValueError('an anchor or an alias');
  if (s[0] === '!') throw new ValueError('a tag');
  if (/^[,%@`\]}]/.test(s) || /^[-?:](?:[ \t]|$)/.test(s)) throw new ValueError('a value that starts with a YAML indicator');
  const match = /^(.*?)(?:[ \t]+(#.*))?$/.exec(s);
  const value = match[1].replace(/[ \t]+$/, '');
  if (/:(?:[ \t]|$)/.test(value)) throw new ValueError('a map (": " in a plain value)');
  const empty = /^(?:~|null|Null|NULL)$/.test(value);
  return { value: empty ? '' : value, comment: match[2] || '', quote: '', empty, blank: false };
}

/** Run a decode. A ValueError becomes a refusal with the line. */
function decodeAt(doc, index, what, fn) {
  try {
    return fn();
  } catch (error) {
    if (error instanceof ValueError) throw unsupported(doc, index, `${error.message} in ${what}`);
    throw error;
  }
}

/** A scalar field that a script reads or writes: a value on the key line only. `null` when the key is missing. */
function scalarField(doc, key) {
  const field = doc.fm.fields.get(key);
  if (!field) return null;
  for (let index = field.start + 1; index < field.end; index += 1) {
    const text = doc.lines[index].text;
    if (text.trim() === '' || /^ +#/.test(text)) continue;
    throw unsupported(doc, index, /^ *-(?:[ \t]|$)/.test(text) ? `a list value for "${key}"` : `a value of more than one line for "${key}"`);
  }
  return { field, ...decodeAt(doc, field.start, `"${key}"`, () => decodeScalar(field.rest)) };
}

/** The decoded value of a scalar field, or '' when the key is missing or empty. */
function getScalar(doc, key) {
  const found = scalarField(doc, key);
  return found ? found.value : '';
}

/**
 * Set a scalar field to a plain value on its key line. A trailing comment stays. A missing field goes after the first
 * key of `after` that the file has, else before the closing "---".
 */
function setScalar(doc, key, value, after = []) {
  const found = scalarField(doc, key);
  if (found) return replaceLine(doc, found.field.start, `${key}: ${value}${found.comment ? ` ${found.comment}` : ''}`);
  const anchor = after.map((name) => doc.fm.fields.get(name)).find(Boolean);
  insertLines(doc, anchor ? anchor.end : doc.fm.close, [`${key}: ${value}`]);
  return true;
}

function quoteLike(quote, value) {
  if (quote === "'") return `'${value.replace(/'/g, "''")}'`;
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * The form of a list field: 'missing', 'empty' (no value), 'block' (`- item` lines), or 'flow' (one line `[a, b]`).
 * Each item is a scalar on one line. A flow list with a comment, a quoted comma, or a nested value is a refusal.
 */
function listField(doc, key) {
  const field = doc.fm.fields.get(key);
  if (!field) return { kind: 'missing', items: [] };
  const what = `"${key}"`;
  if (field.rest.replace(/^[ \t]+/, '').startsWith('[')) {
    for (let index = field.start + 1; index < field.end; index += 1) {
      if (doc.lines[index].text.trim() !== '') throw unsupported(doc, index, `a flow list of ${what} on more than one line`);
    }
    return { kind: 'flow', field, ...parseFlow(doc, field, what) };
  }
  const head = decodeAt(doc, field.start, what, () => decodeScalar(field.rest));
  if (!head.blank) throw unsupported(doc, field.start, `${what} must be a list or have no value`);
  const items = [];
  let indent = null;
  for (let index = field.start + 1; index < field.end; index += 1) {
    const text = doc.lines[index].text;
    if (text.trim() === '' || /^ *#/.test(text)) continue;
    const item = /^( *)- (.*)$/.exec(text);
    if (!item) throw unsupported(doc, index, `an item of ${what} must be "- <value>" on one line`);
    if (indent !== null && item[1] !== indent) throw unsupported(doc, index, `the items of ${what} have different indents`);
    indent = item[1];
    const decoded = decodeAt(doc, index, `an item of ${what}`, () => decodeScalar(item[2]));
    if (decoded.empty) throw unsupported(doc, index, `an empty item of ${what}`);
    items.push({ index, value: decoded.value, quote: decoded.quote });
  }
  return { kind: items.length === 0 ? 'empty' : 'block', field, items, indent: indent === null ? '  ' : indent };
}

/** A one-line flow list: its items and the column of its closing bracket on the key line. */
function parseFlow(doc, field, what) {
  const line = doc.lines[field.start].text;
  const items = [];
  const fail = (why) => unsupported(doc, field.start, `${why} in the flow list of ${what}`);
  let index = line.indexOf('[', line.indexOf(':') + 1) + 1;
  const skip = () => {
    while (line[index] === ' ' || line[index] === '\t') index += 1;
  };
  const end = () => {
    const tail = line.slice(index + 1).trim();
    if (tail !== '') throw fail(tail.startsWith('#') ? 'a comment' : 'text after the list');
    return { items, closeAt: index };
  };
  skip();
  if (line[index] === ']') return end();
  for (;;) {
    skip();
    const c = line[index];
    if (c === '"' || c === "'") {
      const read = decodeAt(doc, field.start, `the flow list of ${what}`, () => (c === '"' ? readDouble(line, index) : readSingle(line, index)));
      if (read.value.includes(',')) throw fail('a quoted comma');
      items.push({ value: read.value, quote: c });
      index = read.end;
    } else {
      const match = /^[^,[\]{}#"'&*!|>%@`]+/.exec(line.slice(index));
      if (!match) throw fail(c === undefined ? 'no closing bracket' : `the character ${JSON.stringify(c)}`);
      const value = match[0].replace(/[ \t]+$/, '');
      if (/:(?:[ \t]|$)/.test(value)) throw fail('a map value');
      items.push({ value, quote: '' });
      index += match[0].length;
    }
    skip();
    if (line[index] === ']') return end();
    if (line[index] !== ',') throw fail(line[index] === undefined ? 'no closing bracket' : `the character ${JSON.stringify(line[index])}`);
    index += 1;
  }
}

/**
 * Add one item to a list field. Each existing item stays exactly as it is. The new item takes the form of the last
 * item (single quotes when the last item has them, else double quotes). A missing field goes before the first key of
 * `before` that the file has, else before the closing "---".
 */
function addListItem(doc, key, item, before = []) {
  const list = listField(doc, key);
  if (list.items.some((existing) => existing.value === item)) return false;
  const last = list.items[list.items.length - 1];
  const quoted = quoteLike(last ? last.quote : '"', item);
  if (list.kind === 'missing') {
    const anchor = before.map((name) => doc.fm.fields.get(name)).find(Boolean);
    insertLines(doc, anchor ? anchor.start : doc.fm.close, [`${key}:`, `  - ${quoted}`]);
  } else if (list.kind === 'flow') {
    const line = doc.lines[list.field.start].text;
    const inner = line.slice(0, list.closeAt);
    const kept = inner.replace(/[ \t]+$/, '');
    const text = list.items.length === 0
      ? `${kept}${quoted}${inner.slice(kept.length)}${line.slice(list.closeAt)}`
      : `${kept}, ${quoted}${inner.slice(kept.length)}${line.slice(list.closeAt)}`;
    replaceLine(doc, list.field.start, text);
  } else {
    insertLines(doc, list.kind === 'block' ? last.index + 1 : list.field.start + 1, [`${list.indent}- ${quoted}`]);
  }
  return true;
}

/** The shape of an Orbh session id: 8-4-4-4-12 hex. The script checks ORBH_SESSION_ID with it, never a stamp item. */
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The org of `[flint]` in flint.toml, or '' when the Flint has none (a local Flint). */
function flintOrg(root) {
  let text;
  try {
    text = fs.readFileSync(path.join(root, 'flint.toml'), 'utf8');
  } catch {
    return '';
  }
  let inFlint = false;
  for (const line of text.split(/\r?\n/)) {
    const table = /^\s*\[\[?([^\]]*)\]\]?\s*(?:#.*)?$/.exec(line);
    if (table) {
      inFlint = table[1].trim() === 'flint';
      continue;
    }
    const org = inFlint ? /^\s*org\s*=\s*(?:"([^"]*)"|'([^']*)')\s*(?:#.*)?$/.exec(line) : null;
    if (org) {
      const slug = (org[1] !== undefined ? org[1] : org[2]).trim();
      return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : '';
    }
  }
  return '';
}

/**
 * The address of the session that `flint address me --json` gives (its `by`), or null when the CLI has no
 * `flint address me` (a release before the v1 addresses) or gives no v1 text. The child gets the session id of this
 * run, so its `by` is the address of this session.
 */
function cliAddress(root, session) {
  // SIGKILL: a child that ignores SIGTERM must not hold the lock of the task after the timeout.
  const result = spawnSync('flint', ['address', 'me', '--json'], {
    cwd: root,
    env: { ...process.env, ORBH_SESSION_ID: session },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 15000,
    killSignal: 'SIGKILL',
  });
  if (result.error || result.status !== 0) return null;
  try {
    const { by } = JSON.parse(result.stdout);
    return typeof by === 'string' && by.startsWith('@v1/') && !/\s/.test(by) ? by : null;
  } catch {
    return null;
  }
}

/**
 * Stamp the session in `orb:` (the Flint session tracking rule, revision R27 of NUU Orbh Mission 027). A shard
 * script never parses a v1 address. An item of `orb:` or `orbh-sessions` is the stamp of this session only when its
 * text (with no YAML quotes, trimmed) is exactly one of these forms:
 * - the short form `@v1/<org>/session/<uuid>` (the org of flint.toml, else empty);
 * - `[[<uuid>]]` or the bare `<uuid>` (the UUID is compared in lower case);
 * - the address that `flint address me --json` gives, when the CLI has the command.
 * Else the script appends the address of `flint address me`, or the short form. A rare duplicate of another valid
 * form is accepted: each reader matches by kind and key. `orbh-sessions` never changes.
 */
function trackSession(doc, session) {
  if (!session) return false;
  const id = String(session).trim().toLowerCase();
  if (!SESSION_ID.test(id)) {
    process.stderr.write(`warning: ORBH_SESSION_ID ${JSON.stringify(session)} is not a session UUID: no orb stamp\n`);
    return false;
  }
  const items = SESSION_FIELDS.flatMap((key) => listField(doc, key).items.map((item) => item.value.trim()));
  const short = `@v1/${flintOrg(doc.root)}/session/${id}`;
  const stamped = (form) => items.some((item) => item === form);
  if (stamped(short) || items.some((item) => item.toLowerCase() === `[[${id}]]` || item.toLowerCase() === id)) {
    return false;
  }
  const address = cliAddress(doc.root, id);
  if (address && stamped(address)) return false;
  return addListItem(doc, ORB_FIELD, address || short, ['template', 'authors']);
}

// ---------------------------------------------------------------------------
// The body: headings outside code fences, the Task Log, and the Log of an increment

/** The ATX headings of the body (CommonMark). The lines of a fenced code block are left out. */
function headings(doc) {
  const found = [];
  let fence = null;
  for (let index = bodyStart(doc); index < doc.lines.length; index += 1) {
    const line = doc.lines[index].text;
    if (fence) {
      const closing = /^ {0,3}(`+|~+)[ \t]*$/.exec(line);
      if (closing && closing[1][0] === fence.char && closing[1].length >= fence.length) fence = null;
      continue;
    }
    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (opening && !(opening[1][0] === '`' && opening[2].includes('`'))) {
      fence = { char: opening[1][0], length: opening[1].length };
      continue;
    }
    const heading = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/.exec(line);
    if (heading) found.push({ index, level: heading[1].length, text: (heading[2] || '').replace(/(?:^|[ \t]+)#+$/, '').trim() });
  }
  return found;
}

/** The section of the first heading with this text: its heading line and its end (exclusive). */
function section(doc, text) {
  const all = headings(doc);
  const at = all.findIndex((heading) => heading.text === text);
  if (at < 0) return null;
  const next = all.slice(at + 1).find((other) => other.level <= all[at].level);
  return { start: all[at].index, end: next ? next.index : doc.lines.length };
}

/** The index after the last line of a section that is not blank. */
function lastContentLine(doc, sect) {
  let at = sect.end;
  while (at > sect.start + 1 && doc.lines[at - 1].text.trim() === '') at -= 1;
  return at;
}

/** Append one line to the `# Task Log` section. A file with no such section gets one at the end. */
function appendTaskLog(doc, line) {
  const sect = section(doc, 'Task Log');
  if (!sect) {
    insertLines(doc, doc.lines.length, ['', '# Task Log', '', line]);
    return;
  }
  const at = lastContentLine(doc, sect);
  insertLines(doc, at, at === sect.start + 1 ? ['', line] : [line]);
}

/** The provenance of a log line. A run by hand has no behaviour: the line names the script. */
function provenance(env, script) {
  const by = env.behaviour ? `behaviour ${env.behaviour}` : `script ${script}`;
  return `${by}, invocation ${env.invocation || 'none'}, session ${env.session || 'none'}`;
}

/** The increment that `from` names (a wikilink to an "(Increment) ..." title), or null. */
function incrementOf(doc) {
  const match = /^\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]$/.exec(getScalar(doc, 'from').trim());
  const target = match ? match[1].trim() : null;
  return target && target.startsWith('(Increment)') ? target : null;
}

/** The marker of the completion row that task-close writes. Only a line with this exact text counts as the row. */
function completionMarker(taskTitle) {
  return `[[${taskTitle}]] completed (task-close`;
}

/** True when the Log section of the increment has the completion row of the task. */
function hasCompletionRow(doc, taskTitle) {
  const sect = section(doc, 'Log');
  if (!sect) return false;
  const marker = completionMarker(taskTitle);
  for (let index = sect.start + 1; index < sect.end; index += 1) {
    if (doc.lines[index].text.includes(marker)) return true;
  }
  return false;
}

/**
 * Prepare the completion row in the Log section of an increment, in memory. The Increments template has a table
 * (`| Date | Version | Change |`); an older log is a list. Returns a phrase for the result line. `doc.changed` says
 * whether there is a row to write.
 */
function prepareIncrementRow(doc, increment, taskTitle, date, env) {
  const sect = section(doc, 'Log');
  if (!sect) return `the increment log needs a line: ${increment} has no Log section`;
  if (hasCompletionRow(doc, taskTitle)) return `the increment log of ${increment} has the completion row`;
  const change = `${completionMarker(taskTitle)}; ${provenance(env, 'task-close')})`;
  const at = lastContentLine(doc, sect);
  if (at > sect.start + 1 && doc.lines[at - 1].text.trim().startsWith('|')) {
    if (taskTitle.includes('|')) return `the increment log needs a line: the task title has "|", and the Log of ${increment} is a table`;
    const version = (/^\(Increment\)\s+(\S+)/.exec(increment) || [])[1] || '';
    insertLines(doc, at, [`| ${date} | ${version} | ${change} |`]);
  } else {
    insertLines(doc, at, at === sect.start + 1 ? ['', `- ${date}: ${change}`] : [`- ${date}: ${change}`]);
  }
  return `increment log of ${increment} updated`;
}

// ---------------------------------------------------------------------------
// The pin, and the run wrapper

/** Pin the task in the session with `flint helper pins add`. Returns a phrase for the result line, or null. */
function pinTask(root, file, session) {
  if (!session) return null;
  const relative = path.relative(root, file);
  // SIGKILL: a child that ignores SIGTERM must not hold the behaviour after the timeout.
  const result = spawnSync('flint', ['helper', 'pins', 'add', relative], {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30000,
    killSignal: 'SIGKILL',
  });
  if (result.error || result.status !== 0) {
    const reason = result.error
      ? result.error.message
      : (result.stderr || result.stdout || `exit ${result.status === null ? result.signal : result.status}`).trim().split('\n')[0];
    process.stderr.write(`warning: flint helper pins add failed: ${reason}\n`);
    return `pin failed (${reason})`;
  }
  return 'pinned';
}

/** Run the main function of a script. A TaskError or any other error prints on stderr and exits 1. */
function run(name, main) {
  try {
    const line = main(process.argv.slice(2));
    if (line) process.stdout.write(`${line}\n`);
  } catch (error) {
    const message = error instanceof TaskError ? error.message : error && error.stack ? error.stack : String(error);
    process.stderr.write(`${name}: ${message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  TaskError,
  today,
  readEnv,
  findMeshFile,
  findIncrement,
  shortName,
  withLocks,
  readDoc,
  writeDoc,
  getScalar,
  setScalar,
  trackSession,
  appendTaskLog,
  provenance,
  incrementOf,
  hasCompletionRow,
  prepareIncrementRow,
  decodeScalar,
  pinTask,
  run,
  // The Tasks shard: the exports of its copy.
  quoteLike,
  replaceLine,
  listField,
  addListItem,
};

if (require.main === module) {
  process.stderr.write('task-lib is the shared module of the Tasks shard scripts, not a command. Run: flint shard task task-new|task-link|task-sync\n');
  process.exitCode = 2;
}
