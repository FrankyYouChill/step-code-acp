import { mkdtemp, readdir, rm, writeFile, chmod, realpath } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const archives = (await readdir(join(root, 'dist'))).filter(name => name.endsWith('.tar.gz'));
assert.equal(archives.length, 1, 'Test one native archive per build job');
const temporary = await mkdtemp(join(tmpdir(), 'step-code-acp-release-'));
const relocated = join(temporary, 'relocated package with spaces');
try {
  const unpack = spawnSync('tar', ['-xzf',join(root, 'dist', archives[0]),'-C',temporary], {encoding:'utf8'});
  assert.equal(unpack.status, 0, unpack.stderr);
  // Rename the entire extraction root, including node_modules and the runtime.
  const { mkdir, rename } = await import('node:fs/promises');
  await mkdir(relocated);
  for (const name of await readdir(temporary)) {
    if (name !== 'relocated package with spaces') await rename(join(temporary,name),join(relocated,name));
  }
  const binary = join(relocated, 'step-code-acp');
  const run = spawnSync(process.execPath, [join(root,'smoke-acp.mjs'),'--simulate-failure'], {env:{...process.env,STEP_CODE_ACP_BINARY:binary},encoding:'utf8',timeout:120000});
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const initialize = JSON.parse(run.stdout.split('\n').find(line => line.startsWith('{')));
  assert.equal(initialize.agentInfo.name, 'step-code-acp');
  const terminal = initialize.authMethods.find(method => method.type === 'terminal');
  assert.ok(terminal);
  assert.deepEqual(terminal.args, ['--terminal-login']);
  assert.equal(await realpath(terminal._meta?.['terminal-auth']?.command), await realpath(join(relocated,'runtime/node')));
  const fixture = join(temporary, 'fake-step.mjs');
  await writeFile(fixture, '#!' + process.execPath + '\nconsole.log("STEP_TERMINAL_AUTH_FIXTURE_OK");\n');
  await chmod(fixture, 0o755);
  const auth = spawnSync(binary, ['--terminal-login'], {env:{...process.env,STEP_CODE_BINARY:fixture},encoding:'utf8',timeout:15000});
  assert.equal(auth.status, 0, auth.stderr);
  assert.ok(auth.stdout.includes('STEP_TERMINAL_AUTH_FIXTURE_OK'));
  console.log('Release archive passed relocated ACP startup, provider-failure propagation, and terminal-auth launch checks.');
} finally {
  await rm(temporary, {recursive:true,force:true});
}
