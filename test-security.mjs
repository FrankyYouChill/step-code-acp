import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, rm, writeFile, chmod} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {z} from 'zod/v4';
import {INPUT_LIMITS, ndJsonStream} from './acp-transport.mjs';

const root = dirname(fileURLToPath(import.meta.url));

test('JSONL transport preserves split UTF-8, CRLF and a final unterminated frame', async () => {
  const bytes=Buffer.from('{"jsonrpc":"2.0","id":1,"result":"caf\u00e9"}\r\n{"jsonrpc":"2.0","id":2,"result":true}');
  const split=bytes.indexOf(Buffer.from('\u00e9'))+1;
  const input=new ReadableStream({start(controller){
    controller.enqueue(bytes.subarray(0,split));
    controller.enqueue(bytes.subarray(split));
    controller.close();
  }});
  const stream=ndJsonStream(new WritableStream({write(){}}),input);
  const messages=[];
  for await(const message of stream.readable)messages.push(message);
  assert.deepEqual(messages,[{jsonrpc:'2.0',id:1,result:'caf\u00e9'},{jsonrpc:'2.0',id:2,result:true}]);
});

test('patched Zod rejects oversized constrained collections before walking elements', () => {
  const result = z.array(z.string()).max(10).safeParse(Array(50000).fill(123));
  assert.equal(result.success, false);
  assert.equal(result.error.issues.length, 1);
  assert.equal(result.error.issues[0].code, 'too_big');
});

test('malformed, oversized and failed requests do not log credentials or conversation text', {timeout:20000}, async () => {
  const temporary = await mkdtemp(join(tmpdir(),'step-code-security-'));
  // Deliberately not a live credential. Split writes defeat chunk-based regex redaction.
  const secret = 'FIXTURE_PRIVATE_TOKEN_73f20d19';
  const privatePrompt = 'PRIVATE_CONVERSATION_FIXTURE_491e';
  const fixture = join(temporary,'fake-step.mjs');
  await writeFile(fixture, `#!${process.execPath}
import readline from 'node:readline';
if (!process.argv.includes('confirm') || !process.argv.includes('deny')) process.exit(2);
process.stderr.write('Bearer FIXTURE_PRIVATE_');
setTimeout(() => { process.stderr.write('TOKEN_73f20d19'); process.exit(1); }, 80);
readline.createInterface({input:process.stdin}).on('line', () => {});
`);
  await chmod(fixture,0o755);
  const child = spawn(process.env.STEP_CODE_ACP_BINARY || join(root,'bin/step-code-acp'),[],{
    detached:true, stdio:['pipe','pipe','pipe'],
    env:{...process.env,STEP_CODE_BINARY:fixture,STEP_CODE_ACP_HOME:join(temporary,'state')},
  });
  let stderr = '', buffer = '';
  const pending = new Map();
  child.stderr.on('data',chunk=>{stderr+=chunk;});
  child.stdout.setEncoding('utf8');
  child.stdout.on('data',chunk=>{
    buffer += chunk;
    let end;
    while ((end=buffer.indexOf('\n')) !== -1) {
      const message=JSON.parse(buffer.slice(0,end)); buffer=buffer.slice(end+1);
      if (message.id !== undefined) pending.get(message.id)?.(message);
    }
  });
  function request(id,method,params) {
    return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{pending.delete(id);reject(new Error('Fixture request timed out'));},4000);
      pending.set(id,message=>{clearTimeout(timeout);pending.delete(id);resolve(message);});
      child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
    });
  }
  try {
    child.stdin.write('{"Authorization":"Bearer '+secret+'",BROKEN}\n');
    child.stdin.write('123\n[]\n{"jsonrpc":"2.0","id":[],"method":"initialize"}\n');
    // Normal UTF-8 requests must remain compatible with the bounded parser.
    const first = await request(1,'initialize',{protocolVersion:1,clientInfo:{name:'fixture-\u00e9',version:'1'},clientCapabilities:{}});
    assert.equal(first.result.agentInfo.version,'0.2.2');
    const invalid = await request(2,'session/prompt',{sessionId:'missing',prompt:[{type:'text',text:privatePrompt}]});
    assert.ok(invalid.error);
    const oversized = await request(3,'initialize',{protocolVersion:1,clientCapabilities:{},_meta:{values:Array(INPUT_LIMITS.collection+1).fill(secret)}});
    assert.equal(oversized.error.code,-32602);
    let nested={}; for(let i=0;i<INPUT_LIMITS.depth+1;i++) nested={value:nested};
    assert.equal((await request(6,'initialize',{protocolVersion:1,clientCapabilities:{},_meta:nested})).error.code,-32602);
    child.stdin.write('{"oversized":"');
    child.stdin.write('x'.repeat(INPUT_LIMITS.bytes));
    child.stdin.write(secret+'"}\n');
    assert.ok((await request(4,'initialize',{protocolVersion:1,clientCapabilities:{}})).result);
    const failed = await request(5,'session/new',{cwd:temporary,mcpServers:[{name:'t3-code',command:'/not-executed',args:['acp-mcp-bridge'],env:[{name:'T3_ACP_MCP_ENDPOINT',value:'http://127.0.0.1:9/mcp'},{name:'T3_ACP_MCP_AUTHORIZATION',value:'Bearer '+secret}]}]});
    assert.ok(failed.error);
    await delay(100);
    assert.match(stderr,/payload omitted/);
    assert.match(stderr,/diagnostic output; content omitted/);
    assert.ok(!stderr.includes(secret), 'Credential appeared in stderr');
    assert.ok(!stderr.includes(privatePrompt), 'Conversation appeared in stderr');
    assert.ok(!stderr.includes('FIXTURE_PRIVATE_'), 'Split credential appeared in stderr');
  } finally {
    const closed=once(child,'close');
    try {process.kill(-child.pid,'SIGTERM');} catch {}
    await closed;
    await rm(temporary,{recursive:true,force:true});
  }
});
