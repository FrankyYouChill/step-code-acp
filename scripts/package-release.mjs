// Package only explicit public files and production dependencies. The Node
// executable/license come from the runtime installed by actions/setup-node.
import { cp, mkdir, mkdtemp, readFile, writeFile, chmod, rm, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const target = `${process.platform}-${process.arch === 'arm64' ? 'aarch64' : process.arch === 'x64' ? 'x86_64' : process.arch}`;
if (!['darwin-aarch64', 'darwin-x86_64', 'linux-aarch64', 'linux-x86_64'].includes(target)) throw new Error('Unsupported release target: ' + target);
const temporary = await mkdtemp(join(tmpdir(), 'step-code-acp-package-'));
const staging = join(temporary, 'package');
const dist = join(root, 'dist');
await mkdir(staging);
await mkdir(dist, {recursive:true});
try {
  for (const path of ['.generated','node_modules','package.json','package-lock.json','acp-transport.mjs','step-rpc.mjs','t3-mcp-client.mjs','t3-mcp-extension.mjs','LICENSE','THIRD_PARTY_NOTICES.md','README.md','README.zh-CN.md','docs','SECURITY.md','registry/step-code-acp/icon.svg']) {
    await cp(join(root, path), join(staging, path), {recursive:true,verbatimSymlinks:true});
  }
  await mkdir(join(staging, 'runtime'));
  await mkdir(join(staging, 'bin'));
  await cp(process.execPath, join(staging, 'runtime/node'));
  const nodeLicense = join(dirname(dirname(process.execPath)), 'LICENSE');
  await access(nodeLicense);
  await cp(nodeLicense, join(staging, 'runtime/LICENSE'));
  const launch = '#!/bin/sh\nstep_acp_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexec "$step_acp_root/runtime/node" "$step_acp_root/.generated/adapter.mjs" "$@"\n';
  const rpc = '#!/bin/sh\nstep_acp_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)\nexec "$step_acp_root/runtime/node" "$step_acp_root/step-rpc.mjs" "$@"\n';
  await writeFile(join(staging, 'step-code-acp'), launch);
  await writeFile(join(staging, 'bin/step-code-rpc'), rpc);
  for (const path of ['runtime/node','step-code-acp','bin/step-code-rpc']) await chmod(join(staging, path), 0o755);
  const name = `step-code-acp-${pkg.version}-${target}.tar.gz`;
  // Remove only superseded archives produced by this script for this platform.
  const {readdir} = await import('node:fs/promises');
  for (const previous of await readdir(dist)) {
    if (previous.startsWith('step-code-acp-') && previous.includes(`-${target}.tar.gz`)) {
      await rm(join(dist,previous));
    }
  }
  const archive = join(dist, name);
  const tar = spawnSync('tar', ['-czf',archive,'-C',staging,'.'], {encoding:'utf8',env:{...process.env,COPYFILE_DISABLE:'1'}});
  if (tar.status !== 0) throw new Error(tar.stderr || 'tar failed');
  const digest = createHash('sha256').update(await readFile(archive)).digest('hex');
  await writeFile(archive + '.sha256', `${digest}  ${name}\n`);
  console.log(JSON.stringify({archive,target,sha256:digest,node:process.version}));
} finally {
  await rm(temporary, {recursive:true,force:true});
}
