// License: The GPL version 3, or LGPL version 3 (Dual License).
// Local demo orchestration: `node scripts/demo.mjs <setup|backend|run|down|reset>`.
// Cross-platform (Node only). It needs Docker for the local PostgreSQL and no
// cloud account, credential, or .env file.
import { spawn, spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const docker = process.platform === 'win32' ? 'docker.exe' : 'docker';

/** Environment for the local backend. Local demo values only; not secrets. */
const backendEnv = {
  ...process.env,
  APP_MODE: 'local',
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:55432/spa_reference',
};

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error?.code === 'ENOENT') {
    console.error(`\`${command}\` was not found. Docker is required for the local PostgreSQL.`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function setup() {
  run(docker, ['compose', 'up', '-d', '--wait', 'postgres']);
  run(npm, ['run', 'prisma:generate']);
  run(npm, ['run', 'migrate:deploy'], backendEnv);
}

function start(label, args, env) {
  return spawn(npm, args, {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }).on('error', (error) => {
    console.error(`${label}: ${error.message}`);
    process.exit(1);
  });
}

function runAll() {
  setup();
  console.log('\nLocal demo: open http://localhost:5173/ (Ctrl+C to stop).\n');
  const children = [
    start('backend', ['run', 'dev', '-w', '@spa-ref/backend'], backendEnv),
    start('frontend', ['run', 'dev', '-w', '@spa-ref/frontend'], process.env),
  ];
  const stop = () => {
    for (const child of children) child.kill();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  let remaining = children.length;
  for (const child of children) {
    child.on('exit', () => {
      remaining -= 1;
      stop();
      if (remaining === 0) process.exit(0);
    });
  }
}

const command = process.argv[2];
switch (command) {
  case 'setup':
    setup();
    break;
  case 'backend':
    start('backend', ['run', 'dev', '-w', '@spa-ref/backend'], backendEnv);
    break;
  case 'run':
    runAll();
    break;
  case 'down':
    run(docker, ['compose', 'down']);
    break;
  case 'reset':
    // Removes the database volume and the local attachment/delivery records.
    run(docker, ['compose', 'down', '--volumes']);
    await rm(resolve(root, '.local'), { recursive: true, force: true });
    console.log('Local demo data removed. Run `npm run demo` to start again.');
    break;
  default:
    console.error('Usage: node scripts/demo.mjs <setup|backend|run|down|reset>');
    process.exit(1);
}
