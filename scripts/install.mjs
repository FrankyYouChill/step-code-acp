import { mkdir, lstat, readlink, symlink, rename, unlink, writeFile, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

if (process.platform === 'win32') throw new Error('Use macOS or Linux for this preview.');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localBin = join(homedir(), '.local', 'bin');
const link = join(localBin, 'step-code-acp');
const target = join(root, 'bin', 'step-code-acp');
await mkdir(localBin, { recursive: true });
let existing;
try { existing = await lstat(link); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const same = existing?.isSymbolicLink() && await readlink(link) === target;
if (process.argv.includes('--uninstall')) {
  if (same) await unlink(link);
  console.log(same ? 'Removed this installation’s ACP link. Step Code and T3 data are preserved.' : 'No link owned by this checkout; nothing removed.');
} else {
  if (existing && !same) {
    if (!process.argv.includes('--replace-link')) throw new Error('Existing executable preserved. To back it up and replace it, run: node scripts/install.mjs --replace-link');
    const backup = link + '.backup-' + Date.now();
    await rename(link, backup);
    console.log('Previous executable backed up at ' + backup);
  }
  if (!same) await symlink(target, link);
  const quote = s => "'" + s.replaceAll("'", "'\\''") + "'";
  const launcher = join(root, 'Launch T3 with Step Code icon.command');
  await writeFile(launcher, '#!/bin/sh\nexec ' + quote(process.execPath) + ' ' + quote(join(root, 'scripts/t3-branding.mjs')) + ' launch\n');
  await chmod(launcher, 0o755);
  if (process.platform === 'darwin') {
    const contents = join(root, 'T3 with Step Code.app', 'Contents');
    await mkdir(join(contents, 'MacOS'), {recursive:true});
    await writeFile(join(contents, 'Info.plist'), '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleExecutable</key><string>launcher</string><key>CFBundleIdentifier</key><string>io.github.frankyyouchill.step-code-acp-launcher</string><key>CFBundleName</key><string>T3 with Step Code</string><key>CFBundlePackageType</key><string>APPL</string><key>LSUIElement</key><true/></dict></plist>');
    const cSource = join(root, '.generated/macos-launcher.c');
    await writeFile(cSource, '#include <unistd.h>\n#include <stdio.h>\nint main(void) { freopen(' + JSON.stringify(join(root, '.generated/launcher.log')) + ', "a", stderr); execl(' + JSON.stringify(process.execPath) + ', "node", ' + JSON.stringify(join(root, 'scripts/t3-branding.mjs')) + ', "launch", (char*)0); perror("Step Code launcher"); return 1; }\n');
    const compiled = spawnSync('/usr/bin/cc', [cSource, '-o', join(contents, 'MacOS/launcher')], {encoding:'utf8'});
    if (compiled.status !== 0) console.log('Native Finder launcher needs Apple Command Line Tools. You can use npm run t3:launch instead.');
  }
  console.log('T3 Local ACP command:\n  Executable: ' + link + '\n  Display name: Step Code\n  Arguments: empty\n  Environment: empty (uses your existing Step Code configuration)');
}
