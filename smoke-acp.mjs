import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, mkdir, chmod } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
const cwd = await mkdtemp(join(tmpdir(), 'step-t3-acp-'));
const nonce = randomUUID();
await writeFile(join(cwd, 'demo-input.txt'), nonce);
const simulateFailure = process.argv.includes('--simulate-failure');
const env = { ...process.env };
env.STEP_CODE_ACP_HOME = join(cwd, 'acp-mappings');
if (simulateFailure) {
  const mock = join(cwd, 'step-failure-fixture');
  await writeFile(mock, `#!${process.execPath}
import readline from 'node:readline';
const send = x => console.log(JSON.stringify(x));
readline.createInterface({input:process.stdin}).on('line', line => {
  const x=JSON.parse(line); let data={};
  const model={id:'fixture',provider:'step',name:'fixture',contextWindow:10000,maxTokens:1000,reasoning:false,input:['text'],cost:{input:0,output:0,cacheRead:0,cacheWrite:0}};
  if(x.type==='get_state')data={model,sessionId:'fixture',sessionFile:${JSON.stringify(join(cwd, 'fixture.jsonl'))},thinkingLevel:'off',isStreaming:false};
  if(x.type==='get_available_models')data={models:[model]};
  if(x.type==='get_available_thinking_levels')data={levels:['off']};
  if(x.type==='get_commands')data={commands:[]};
  if(x.type==='get_session_stats')data={tokens:{total:0},contextUsage:{tokens:0,contextWindow:10000}};
  send({type:'response',id:x.id,command:x.type,success:true,data});
  if(x.type==='prompt'){
    send({type:'agent_start'});
    send({type:'message_end',message:{role:'assistant',content:[],stopReason:'error',errorMessage:'SIMULATED_PROVIDER_FAILURE'}});
    send({type:'agent_settled',failure:{message:'SIMULATED_PROVIDER_FAILURE'}});
  }
});
`);
  await chmod(mock, 0o755);
  env.STEP_CODE_BINARY = mock;
}
const child = spawn(process.env.STEP_CODE_ACP_BINARY || join(root, 'bin/step-code-acp'), [], {
  cwd, stdio: ['pipe', 'pipe', 'pipe'], detached: true, env,
});
const pending = new Map();
let count = 0, buffer = '', stderr = '';
const updates = [], permissions = [];
function send(value) { child.stdin.write(JSON.stringify(value) + '\n'); }
function request(method, params) {
  const id = ++count;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('ACP timeout: ' + method)); }, 100000);
    pending.set(id, { resolve: v => { clearTimeout(timer); resolve(v); }, reject: e => { clearTimeout(timer); reject(e); } });
    send({ jsonrpc: '2.0', id, method, params });
  });
}
child.stdout.setEncoding('utf8');
child.stdout.on('data', data => {
  buffer += data;
  let end;
  while ((end = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
    let message;
    try { message = JSON.parse(line); } catch { console.error('Invalid ACP JSON output'); continue; }
    if (message.method === 'session/update') updates.push(message.params.update);
    else if (message.method === 'session/request_permission') {
      permissions.push(message.params);
      const option = message.params.options.find(o => o.kind === 'allow_once');
      send({ jsonrpc: '2.0', id: message.id, result: { outcome: option ? { outcome: 'selected', optionId: option.optionId } : { outcome: 'cancelled' } } });
    } else if (message.method && message.id !== undefined) {
      send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Not supported by smoke-test client' } });
    } else if (message.id !== undefined) {
      const item = pending.get(message.id); pending.delete(message.id);
      if (message.error) item?.reject(new Error(JSON.stringify(message.error)));
      else item?.resolve(message.result);
    }
  }
});
child.stderr.on('data', d => { stderr = (stderr + d.toString()).slice(-8000); });
child.on('exit', code => { for (const item of pending.values()) item.reject(new Error('Adapter exited: ' + code)); pending.clear(); });
try {
  const initialize = await request('initialize', { protocolVersion: 1, clientInfo: { name: 'step-code-t3-smoke', version: '0.1.0' }, clientCapabilities: {_meta:{'terminal-auth':true}} });
  console.log(JSON.stringify({ phase: 'initialize', ...initialize }));
  const session = await request('session/new', { cwd, mcpServers: [] });
  console.log(JSON.stringify({ phase: 'session', sessionId: session.sessionId, models: session.models }));
  if (simulateFailure) {
    let failed = false;
    try { await request('session/prompt', {sessionId:session.sessionId,prompt:[{type:'text',text:'Simulate a provider error'}]}); }
    catch(error) { failed = error.message.includes('SIMULATED_PROVIDER_FAILURE'); }
    console.log(JSON.stringify({ simulatedFailureReportedAsError: failed }));
    if(!failed) throw new Error('A failed Step Code run was incorrectly reported as success');
  } else {
  const response = await request('session/prompt', { sessionId: session.sessionId, prompt: [{ type: 'text', text: 'Use the read tool to read demo-input.txt. Use the write tool to create demo-result.txt containing exactly its contents followed by a newline and T3_STEP_CODE_OK. Do not use bash or subagents. Do not change any other files. Then reply with exactly DEMO_DONE.' }] });
  const actual = await readFile(join(cwd, 'demo-result.txt'), 'utf8');
  const result = {
    checkedAt: new Date().toISOString(), runtime: process.version,
    adapter: initialize.agentInfo, model: session.models?.currentModelId,
    stopReason: response.stopReason,
    fileCorrect: actual.trimEnd() === nonce + '\nT3_STEP_CODE_OK',
    permissionRequests: permissions.length,
    toolCalls: updates.filter(u => u.sessionUpdate === 'tool_call').map(u => ({ title: u.title, kind: u.kind })),
    streamedText: updates.filter(u => u.sessionUpdate === 'agent_message_chunk').map(u => u.content?.text ?? '').join(''),
    stderrPresent: Boolean(stderr),
  };
  console.log(JSON.stringify(result, null, 2));
  await mkdir(join(root, 'verification'), { recursive: true });
  await writeFile(join(root, 'verification/acp-smoke.json'), JSON.stringify(result, null, 2));
  if (!result.fileCorrect || !result.toolCalls.length) throw new Error('ACP tool smoke test failed');
  }
} catch (error) {
  console.error(error.message);
  if (stderr) console.error('Adapter stderr: ' + stderr.replace(/(?:sk-|Bearer\s+)[A-Za-z0-9._-]+/g, '[redacted]'));
  process.exitCode = 1;
} finally {
  try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  await rm(cwd, { recursive: true, force: true });
}
