// Optional macOS frontend overlay. Reads the user's own T3 archive; never
// modifies or redistributes T3. Version/hash guards deliberately fail closed.
import { open, readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { dirname, join, resolve, extname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const state = join(root, '.generated');
const app = process.env.T3_APP_PATH || '/Applications/T3 Code (Beta).app';
const port = 4318;
const origin = `http://127.0.0.1:${port}`;
const prefix = 'apps/server/dist/client/';
const mainPath = prefix + 'assets/main-sk5g_Jie.js';
const knownHash = '1cc2d181b7f1cab17909638e767f7046c3849af0a0fdd94bed1b52e9e3ff5a26';
const marker = 'f=o?(0,Z.jsx)(Zz,';

export function patchProviderIcon(source, icons) {
  if (source.split(marker).length !== 2) throw new Error('Unsupported T3 icon component; no changes applied.');
  for (const value of Object.values(icons)) {
    if (!/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value)) throw new Error('Only embedded PNG/JPEG icons are accepted.');
  }
  const map = JSON.stringify(icons);
  return source.replace(marker, 'f=(o&&Object.hasOwn(' + map + ',e.displayName))?(0,Z.jsx)(`img`,{src:(' + map + ')[e.displayName],alt:e.displayName,className:J(`size-5 shrink-0 rounded-full object-contain`,i),"data-local-acp-icon":e.displayName}):o?(0,Z.jsx)(Zz,');
}

export async function loadOverlay() {
  const archive = join(app, 'Contents/Resources/app.asar');
  const file = await open(archive, 'r');
  let base, tree;
  try {
    const head = Buffer.alloc(16);
    await file.read(head, 0, 16, 0);
    const length = head.readUInt32LE(12);
    if (length > 20000000) throw new Error('Invalid ASAR header');
    base = 8 + head.readUInt32LE(4);
    const bytes = Buffer.alloc(length);
    await file.read(bytes, 0, length, 16);
    tree = JSON.parse(bytes.toString());
  } finally { await file.close(); }
  function entry(path) {
    let item = tree;
    for (const part of path.split('/')) item = item?.files?.[part];
    return item && typeof item.offset === 'string' && !item.unpacked ? item : null;
  }
  async function bytes(path) {
    const item = entry(path);
    if (!item) throw new Error('Missing packaged T3 asset: ' + path);
    const handle = await open(archive, 'r');
    try {
      const data = Buffer.alloc(item.size);
      await handle.read(data, 0, item.size, base + Number(item.offset));
      return data;
    } finally { await handle.close(); }
  }
  const source = await bytes(mainPath);
  if (createHash('sha256').update(source).digest('hex') !== knownHash) throw new Error('This overlay supports the verified T3 Code 0.1.7 bundle only. Original app remains unchanged.');
  const config = JSON.parse(await readFile(join(root, 'branding.json'), 'utf8'));
  const icons = {};
  for (const [name, path] of Object.entries(config)) {
    const asset = resolve(root, path);
    if (!asset.startsWith(root + '/assets/')) throw new Error('Icon must be inside this checkout’s assets directory');
    const mime = extname(asset) === '.png' ? 'image/png' : extname(asset) === '.jpg' ? 'image/jpeg' : null;
    if (!mime) throw new Error('Unsupported icon format');
    icons[name] = `data:${mime};base64,${(await readFile(asset)).toString('base64')}`;
  }
  return { archive, base, entry, patched: Buffer.from(patchProviderIcon(source.toString(), icons)) };
}

async function health() {
  try {
    const response = await fetch(origin + '/__step_code_acp_health', {signal:AbortSignal.timeout(1000)});
    const body = await response.json();
    return body.project === 'step-code-acp' && body.root === root;
  } catch { return false; }
}

async function serve() {
  const overlay = await loadOverlay();
  const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.wasm':'application/wasm','.json':'application/json'};
  const server = createServer((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, origin).pathname); } catch { res.writeHead(400).end(); return; }
    if (pathname === '/__step_code_acp_health') {
      res.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({project:'step-code-acp',root,pid:process.pid})); return;
    }
    // Only frontend entries are reachable. No user files, credentials or backend proxy.
    let path = posix.normalize(pathname).replace(/^\/+/, '');
    if (!path || !extname(path)) path = 'index.html';
    const key = prefix + path;
    const item = overlay.entry(key);
    if (!item) { res.writeHead(404).end(); return; }
    const patched = key === mainPath ? overlay.patched : null;
    res.writeHead(200, {'Content-Type':types[extname(path)] || 'application/octet-stream','Cache-Control':'no-store','Content-Length':patched?.length ?? item.size});
    if (req.method === 'HEAD') { res.end(); return; }
    if (patched) res.end(patched);
    else createReadStream(overlay.archive, {start:overlay.base + Number(item.offset),end:overlay.base + Number(item.offset) + item.size - 1}).on('error', () => res.destroy()).pipe(res);
  });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log('Local T3 icon overlay ready on ' + origin));
}

async function main() {
  const command = process.argv[2] || 'check';
  if (command === 'check') { await loadOverlay(); console.log('Verified T3 0.1.7 bundle and local Step Code icon. Original app unchanged.'); return; }
  if (command === 'serve') { await serve(); return; }
  if (command === 'stop') {
    if (await health()) {
      const info = await (await fetch(origin + '/__step_code_acp_health')).json();
      process.kill(info.pid, 'SIGTERM');
    }
    await unlink(join(state, 'branding.pid')).catch(e => {if(e.code !== 'ENOENT')throw e;});
    console.log('Overlay stopped. Quit T3, then open T3 normally to restore the standard frontend.'); return;
  }
  if (command !== 'launch') throw new Error('Usage: t3-branding.mjs check|launch|stop|serve');
  if (process.platform !== 'darwin') throw new Error('The optional desktop overlay currently supports macOS only. The ACP adapter also supports Linux.');
  await loadOverlay();
  if (!await health()) {
    await mkdir(state, {recursive:true});
    const log = await open(join(state, 'branding.log'), 'a');
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'serve'], {detached:true,stdio:['ignore',log.fd,log.fd]});
    child.unref(); await log.close();
    await writeFile(join(state, 'branding.pid'), String(child.pid));
    let ready = false;
    for (let i=0; i<30; i++) {
      if (await health()) {ready=true;break;}
      await new Promise(r => setTimeout(r, 100));
    }
    if (!ready) throw new Error('Overlay could not start; check .generated/branding.log. Is port 4318 in use?');
  }
  console.log('Opening T3 with the local icon overlay. Quit an already-running T3 first; otherwise macOS keeps its existing environment.');
  const child = spawn('/usr/bin/open', ['-a',app,'--env',`VITE_DEV_SERVER_URL=${origin}`,'--env',`T3CODE_HOME=${process.env.T3CODE_HOME || join(homedir(), '.t3')}`,'--env',`T3CODE_PORT=${process.env.T3CODE_PORT || '3773'}`], {stdio:'inherit'});
  child.on('exit', code => {process.exitCode = code ?? 1;});
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch(error => {console.error(error.message); process.exitCode = 1;});
}
