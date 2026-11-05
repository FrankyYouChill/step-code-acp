import { mkdir, lstat, readlink, symlink, rename, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform === 'win32') throw new Error('Use macOS or Linux for this preview.');
const [nodeMajor,nodeMinor,nodePatch]=process.versions.node.split('.').map(Number);
if(nodeMajor<24 || (nodeMajor===24 && (nodeMinor<22 || (nodeMinor===22 && nodePatch<2)))) throw new Error('Node.js 24.22.2 or newer is required.');
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
  console.log('T3 Local ACP command:\n  Executable: ' + link + '\n  Display name: Step Code\n  Arguments: empty\n  Environment: empty (uses your existing Step Code configuration)');
}
