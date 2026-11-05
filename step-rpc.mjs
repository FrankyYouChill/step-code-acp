import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const executable = process.env.STEP_CODE_BINARY || join(homedir(), '.stepcode/bin/step');
const args = process.argv.slice(2);
const rpc = args.includes('rpc');
if (rpc) {
  args.push('--no-update-check', '--approval-mode', 'confirm', '--non-interactive-approval', 'deny');
}
const child = spawn(executable, args, { stdio: rpc ? ['pipe', 'pipe', 'inherit'] : 'inherit', env: process.env });
if (rpc) {
  process.stdin.pipe(child.stdin);
  child.stdout.pipe(process.stdout);
  child.stdin.on('error', () => {});
  process.stdout.on('error', () => child.kill('SIGTERM'));
  process.stdin.on('end', () => child.kill('SIGTERM'));
}
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
child.on('error', error => { console.error('Cannot start Step Code:', error.message); process.exit(1); });
child.on('exit', code => process.exit(code ?? 1));
