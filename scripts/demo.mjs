// License: The GPL version 3, or LGPL version 3 (Dual License).
// Local demo orchestration: `node scripts/demo.mjs <run|setup|backend|down|reset>`.
// Cross-platform (Node built-ins only). It needs Docker for the local PostgreSQL
// and no cloud account, credential, or .env file. Everything is bound to 127.0.0.1.
import { spawn, spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const win = process.platform === 'win32';
const npm = win ? 'npm.cmd' : 'npm';
const docker = win ? 'docker.exe' : 'docker';

const REQUIRED_NODE_MAJOR = 24;
const HOST = '127.0.0.1';
const PORTS = { frontend: 5173, backend: 3000, postgres: 55432 };
const SPA_URL = `http://${HOST}:${PORTS.frontend}/`;
const BACKEND_READY_URL = `http://${HOST}:${PORTS.backend}/health/ready`;
const READY_TIMEOUT_MS = 120_000;
const DATABASE_WAIT_SECONDS = 90;
const STOP_GRACE_MS = 5_000;

/** Environment for the local backend. Local demo values only; not secrets. */
const backendEnv = {
  ...process.env,
  APP_MODE: 'local',
  HOST,
  PORT: String(PORTS.backend),
  DATABASE_URL: `postgresql://postgres:postgres@${HOST}:${PORTS.postgres}/spa_reference`,
};

class DemoError extends Error {}

function fail(message) {
  throw new DemoError(message);
}

function dockerSync(args, options = {}) {
  return spawnSync(docker, args, { cwd: root, encoding: 'utf8', ...options });
}

// ---------------------------------------------------------------- preflight

function checkNode() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major !== REQUIRED_NODE_MAJOR) {
    fail(
      `Local demo cannot start: Node.js ${REQUIRED_NODE_MAJOR} is required.\n` +
        `  expected: Node.js ${REQUIRED_NODE_MAJOR}.x\n` +
        `  actual:   Node.js ${process.versions.node}\n` +
        'Switch to Node.js 24 (`nvm use` reads .nvmrc), run `npm ci` again, then `npm run demo`.',
    );
  }
}

function checkDocker() {
  const version = dockerSync(['--version']);
  if (version.error?.code === 'ENOENT') {
    fail(
      'Local demo cannot start: the `docker` command was not found.\n' +
        'Install Docker (with Compose v2), then run `npm run demo` again.',
    );
  }
  const compose = dockerSync(['compose', 'version']);
  if (compose.error || compose.status !== 0) {
    fail(
      'Local demo cannot start: Docker Compose v2 (`docker compose`) is not available.\n' +
        'Install or update Docker so that `docker compose version` works, then run `npm run demo` again.',
    );
  }
  const info = dockerSync(['info']);
  if (info.status !== 0) {
    fail(
      'Docker is installed but the Docker daemon is not running.\n' +
        'Start Docker and run `npm run demo` again.',
    );
  }
}

function isPortFree(port) {
  return new Promise((resolvePort) => {
    const server = createServer();
    server.once('error', () => resolvePort(false));
    server.listen(port, HOST, () => server.close(() => resolvePort(true)));
  });
}

function postgresIsRunning() {
  const ps = dockerSync(['compose', 'ps', '--status', 'running', '-q', 'postgres']);
  return ps.status === 0 && ps.stdout.trim() !== '';
}

async function checkPorts(names) {
  for (const name of names) {
    // The demo database from an earlier run legitimately holds its own port.
    if (name === 'postgres' && postgresIsRunning()) continue;
    const port = PORTS[name];
    if (await isPortFree(port)) continue;
    const hint =
      name === 'postgres'
        ? 'Stop the process using that port, or stop an existing demo database with:\n  npm run demo:down'
        : 'Stop the process using that port (for example a previous `npm run demo` still running).';
    fail(`Local demo cannot start: port ${port} (${name}) is already in use on ${HOST}.\n${hint}`);
  }
}

async function preflight(portNames) {
  checkNode();
  checkDocker();
  await checkPorts(portNames);
}

// -------------------------------------------------------------------- steps

function step(title, command, args, { env = process.env, onFailure } = {}) {
  console.log(`\n> ${title}`);
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: win,
  });
  if (result.error || result.status !== 0) {
    fail(`${title} failed.\n${onFailure ?? ''}`.trimEnd());
  }
}

function setup() {
  step(
    'Starting local PostgreSQL (waiting until healthy)',
    docker,
    ['compose', 'up', '-d', '--wait', '--wait-timeout', String(DATABASE_WAIT_SECONDS), 'postgres'],
    {
      onFailure:
        'Diagnose with:\n  docker compose ps\n  docker compose logs postgres\n' +
        'To start from a clean database: npm run demo:reset',
    },
  );
  step('Generating the Prisma client', npm, ['run', 'prisma:generate']);
  step('Applying database migrations', npm, ['run', 'migrate:deploy'], {
    env: backendEnv,
    onFailure:
      'The migration output is above; migration files are in backend/prisma/migrations/.\n' +
      'To start from a clean database: npm run demo:reset',
  });
}

// ----------------------------------------------------------------- children

/** A child process in its own process group, so that its whole tree can be stopped. */
function startChild(label, args, env, { detached = !win } = {}) {
  const child = spawn(npm, args, {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: win,
    detached,
  });
  const handle = { label, child, exited: false, exitCode: null };
  child.on('exit', (code, signal) => {
    handle.exited = true;
    handle.exitCode = code ?? signal;
  });
  child.on('error', (error) => {
    handle.exited = true;
    handle.exitCode = error.message;
  });
  return handle;
}

function signalTree(handle, signal) {
  if (handle.exited || handle.child.pid === undefined) return;
  try {
    if (win) {
      spawnSync('taskkill', ['/pid', String(handle.child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(-handle.child.pid, signal);
    }
  } catch {
    // already gone
  }
}

async function stopChildren(handles) {
  for (const handle of handles) signalTree(handle, 'SIGTERM');
  const deadline = Date.now() + STOP_GRACE_MS;
  while (Date.now() < deadline && handles.some((handle) => !handle.exited)) {
    await new Promise((r) => setTimeout(r, 100));
  }
  for (const handle of handles) signalTree(handle, 'SIGKILL');
}

async function waitUntil(description, probe, handles, diagnostic) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const dead = handles.find((handle) => handle.exited);
    if (dead) {
      fail(
        `Stopped while waiting for ${description}: the ${dead.label} process exited (${dead.exitCode}).\n` +
          `Its output is above. ${diagnostic}`,
      );
    }
    if (await probe()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  fail(
    `Timed out after ${READY_TIMEOUT_MS / 1000}s waiting for ${description}.\n` +
      `The ${handles.map((h) => h.label).join('/')} process is ${
        handles.some((handle) => handle.exited) ? 'not' : 'still'
      } running. ${diagnostic}`,
  );
}

async function httpOk(url, check) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    if (!response.ok) return false;
    return check ? await check(response) : true;
  } catch {
    return false;
  }
}

function printReady() {
  console.log(`
Local demo is ready.

SPA:
  ${SPA_URL}

Demo roles:
  Requester
  Approver
  Administrator

Local delivery records:
  .local/deliveries/

Stop frontend/backend:
  Ctrl+C

Stop local database:
  npm run demo:down

Reset all local demo data:
  npm run demo:reset

Show recorded mail/events:
  npm run demo:deliveries

Guide:
  doc/GETTING_STARTED.md
`);
}

async function runAll() {
  await preflight(['frontend', 'backend', 'postgres']);
  setup();

  console.log('\n> Starting backend and frontend');
  const backend = startChild('backend', ['run', 'dev', '-w', '@spa-ref/backend'], backendEnv);
  const frontend = startChild(
    'frontend',
    [
      'run',
      'dev',
      '-w',
      '@spa-ref/frontend',
      '--',
      '--host',
      HOST,
      '--port',
      String(PORTS.frontend),
      '--strictPort',
    ],
    process.env,
  );
  const handles = [backend, frontend];

  let stopping = false;
  const shutdown = async (code) => {
    if (stopping) return;
    stopping = true;
    console.log(
      '\nStopping frontend and backend (the local database keeps running and keeps its data)...',
    );
    await stopChildren(handles);
    process.exit(code);
  };
  process.on('SIGINT', () => void shutdown(0));
  process.on('SIGTERM', () => void shutdown(0));

  try {
    await waitUntil(
      `the backend (${BACKEND_READY_URL})`,
      () => httpOk(BACKEND_READY_URL, async (r) => (await r.json()).status === 'ok'),
      [backend],
      `Check ${BACKEND_READY_URL} directly and the backend log above. Local mode needs no AWS setting; ` +
        'see doc/GETTING_STARTED.md, section "First-run troubleshooting".',
    );
    await waitUntil(
      `the frontend (${SPA_URL})`,
      () => httpOk(SPA_URL),
      [frontend],
      `Open ${SPA_URL} and check the frontend output above. See doc/GETTING_STARTED.md, section "First-run troubleshooting".`,
    );
  } catch (error) {
    console.error(`\n${error.message}`);
    await shutdown(1);
    return;
  }
  printReady();

  // If either process dies after startup, stop the other one instead of leaving a half-running demo.
  setInterval(() => {
    const dead = handles.find((handle) => handle.exited);
    if (dead && !stopping) {
      console.error(`\nThe ${dead.label} process exited (${dead.exitCode}).`);
      void shutdown(1);
    }
  }, 1_000);
}

// ------------------------------------------------------------ down / reset

function down() {
  checkDocker();
  step('Stopping local PostgreSQL (data is kept)', docker, ['compose', 'down']);
  console.log('Stopped. `npm run demo` starts it again with the same data.');
}

async function reset() {
  checkDocker();
  for (const name of ['frontend', 'backend']) {
    if (!(await isPortFree(PORTS[name]))) {
      fail(
        `Cannot reset: port ${PORTS[name]} (${name}) is in use, so a demo may still be running.\n` +
          'Press Ctrl+C in the terminal running `npm run demo` (or stop the process using the port), then run `npm run demo:reset` again.',
      );
    }
  }
  step('Removing the local PostgreSQL container and its data volume', docker, [
    'compose',
    'down',
    '--volumes',
  ]);
  await rm(resolve(root, '.local', 'attachments'), { recursive: true, force: true });
  await rm(resolve(root, '.local', 'deliveries'), { recursive: true, force: true });
  console.log('\nLocal demo data removed. Run `npm run demo` to start from a blank state.');
}

// --------------------------------------------------------------------- main

const command = process.argv[2];
try {
  switch (command) {
    case 'run':
      await runAll();
      break;
    case 'setup':
      checkNode();
      checkDocker();
      await checkPorts(['postgres']);
      setup();
      break;
    case 'backend':
      checkNode();
      await checkPorts(['backend']);
      startChild('backend', ['run', 'dev', '-w', '@spa-ref/backend'], backendEnv, {
        detached: false,
      });
      break;
    case 'down':
      down();
      break;
    case 'reset':
      await reset();
      break;
    default:
      console.error('Usage: node scripts/demo.mjs <run|setup|backend|down|reset>');
      process.exit(1);
  }
} catch (error) {
  if (!(error instanceof DemoError)) throw error;
  console.error(`\n${error.message}`);
  process.exit(1);
}
