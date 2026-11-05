import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';

const temporaryCwd=await mkdtemp(join(tmpdir(),'step-t3-mcp-'));
const cwd=process.env.STEP_T3_SMOKE_CWD || temporaryCwd;
const secret=randomUUID();
const nonce=randomUUID();
const calls=[];
const server=http.createServer(async(req,res)=>{
  if(req.headers.authorization!=='Bearer '+secret){res.writeHead(401).end();return;}
  let body='';for await(const chunk of req)body+=chunk;
  const message=JSON.parse(body);
  if(message.method==='notifications/initialized'){res.writeHead(204).end();return;}
  let result;
  if(message.method==='initialize')result={protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}};
  if(message.method==='tools/list')result={tools:[{name:'orchestrator_capabilities',description:'Read the test T3 capabilities. Returns a verification marker.',inputSchema:{type:'object',properties:{search:{type:'string'}},required:['search'],additionalProperties:false}}]};
  if(message.method==='tools/call'){
    calls.push(message.params);
    result={content:[{type:'text',text:'STEP_T3_BRIDGE_OK '+nonce}]};
  }
  res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({jsonrpc:'2.0',id:message.id,result}));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const child=spawn(join(dirname(fileURLToPath(import.meta.url)),'bin/step-code-acp'),[],{cwd,stdio:['pipe','pipe','pipe'],detached:true,env:{...process.env,STEP_CODE_ACP_HOME:join(temporaryCwd,'acp-mappings')}});
let buffer='',stderr='',id=0;const pending=new Map(),updates=[];
const send=x=>child.stdin.write(JSON.stringify(x)+'\n');
function request(method,params){return new Promise((resolve,reject)=>{
  const key=++id;const timer=setTimeout(()=>{pending.delete(key);reject(new Error('ACP request timeout: '+method));},90000);
  pending.set(key,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});
  send({jsonrpc:'2.0',id:key,method,params});
});}
child.stdout.setEncoding('utf8');
child.stdout.on('data',chunk=>{
  buffer+=chunk;let end;
  while((end=buffer.indexOf('\n'))!==-1){
    const line=buffer.slice(0,end);buffer=buffer.slice(end+1);
    let m;try{m=JSON.parse(line);}catch{continue;}
    if(m.method==='session/update')updates.push(m.params.update);
    else if(m.method==='session/request_permission'){
      const option=m.params.options.find(o=>o.kind==='allow_once');
      send({jsonrpc:'2.0',id:m.id,result:{outcome:option?{outcome:'selected',optionId:option.optionId}:{outcome:'cancelled'}}});
    }else if(m.id!==undefined){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(new Error(m.error.message)):p?.resolve(m.result);}
  }
});
child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-8000);});
child.on('exit',code=>{for(const p of pending.values())p.reject(new Error('Adapter exited: '+code));pending.clear();});
try{
  const initialized=await request('initialize',{protocolVersion:1,clientCapabilities:{},clientInfo:{name:'t3-mcp-smoke',version:'1'}});
  if(!initialized.agentCapabilities?.mcpCapabilities?.http)throw new Error('HTTP MCP was not advertised');
  const endpoint=`http://127.0.0.1:${server.address().port}/mcp`;
  const descriptor=process.argv.includes('--stdio-descriptor')
    ? {name:'t3-code',command:process.execPath,args:['/fixture/server.mjs','acp-mcp-bridge'],env:[{name:'T3_ACP_MCP_ENDPOINT',value:endpoint},{name:'T3_ACP_MCP_AUTHORIZATION',value:'Bearer '+secret}]}
    : {name:'t3-code',type:'http',url:endpoint,headers:[{name:'Authorization',value:'Bearer '+secret}]};
  const session=await request('session/new',{cwd,mcpServers:[descriptor]});
  if(process.argv.includes('--startup-only')) {
    console.log(JSON.stringify({sessionStartup:true,httpAdvertised:true,models:session.models?.availableModels?.length}));
  } else {
  await request('session/prompt',{sessionId:session.sessionId,prompt:[{type:'text',text:'Call the tool mcp__t3-code__orchestrator_capabilities exactly once with search="bridge-smoke". Do not use any other tools or read/write files. Then reply with exactly the verification marker returned by that tool.'}]});
  const text=updates.filter(u=>u.sessionUpdate==='agent_message_chunk').map(u=>u.content?.text??'').join('');
  const good=calls.length===1&&calls[0].name==='orchestrator_capabilities'&&calls[0].arguments.search==='bridge-smoke'&&text.includes(nonce);
  console.log(JSON.stringify({realStepCodeMcpToolCall:good,httpAdvertised:true,mcpCalls:calls.length,markerMatched:text.includes(nonce),toolTitles:updates.filter(u=>u.sessionUpdate==='tool_call').map(u=>u.title)},null,2));
  if(!good)throw new Error('Step Code did not execute the injected T3 tool');
  }
}catch(error){
  console.error(String(error.message).replaceAll(secret,'[redacted]'));
  if(stderr)console.error(stderr.replaceAll(secret,'[redacted]'));
  process.exitCode=1;
}finally{
  try{process.kill(-child.pid,'SIGTERM');}catch{}
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  await rm(temporaryCwd,{recursive:true,force:true});
}
