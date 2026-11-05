import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { T3McpClient, selectT3Servers } from './t3-mcp-client.mjs';

test('only the local T3 endpoint is accepted; no unrelated servers are activated', () => {
  assert.deepEqual(selectT3Servers([{name:'other',type:'http',url:'https://example.com/mcp'}]), []);
  for (const url of ['https://127.0.0.1/mcp','http://example.com/mcp','http://127.0.0.1/other','http://secret@127.0.0.1/mcp','http://127.0.0.1/mcp?token=secret']) {
    assert.throws(() => selectT3Servers([{name:'t3-code',type:'http',url}]));
  }
  const [stdio] = selectT3Servers([{name:'t3-code',command:'/fixture/node',args:['/fixture/server.mjs','acp-mcp-bridge'],env:[{name:'T3_ACP_MCP_ENDPOINT',value:'http://127.0.0.1:3773/mcp'},{name:'T3_ACP_MCP_AUTHORIZATION',value:'Bearer fixture-only'}]}]);
  assert.equal(stdio.url,'http://127.0.0.1:3773/mcp');
  assert.equal(stdio.headers.Authorization,'Bearer fixture-only');
  assert.throws(()=>selectT3Servers([{name:'t3-code',command:'/fixture/node',args:['arbitrary-script']}]))
});

test('initialize, pagination, authorization, protocol header, SSE response and tool allowlist', async () => {
  let callCount = 0;
  const server = http.createServer(async (req,res) => {
    assert.equal(req.headers.authorization,'Bearer fixture-only');
    assert.equal(req.headers['mcp-protocol-version'],'2025-06-18');
    let body=''; for await (const chunk of req) body+=chunk;
    const message=JSON.parse(body);
    if (message.method==='notifications/initialized') {res.writeHead(204).end(); return;}
    let result;
    if (message.method==='initialize') result={protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}};
    if (message.method==='tools/list') result=message.params.cursor===undefined ? {tools:[],nextCursor:''} : {tools:[{name:'delegate_task',inputSchema:{type:'object'}},{name:'request_secret',inputSchema:{type:'object'}}]};
    if (message.method==='tools/call') {
      callCount++;
      assert.equal(message.params.name,'delegate_task');
      res.writeHead(200,{'content-type':'text/event-stream'});
      res.write('event: message\r\ndata: '+JSON.stringify({jsonrpc:'2.0',id:message.id,result:{content:[{type:'text',text:'actual-child-id'}]}})+'\r\n\r\n');
      res.end();return;
    }
    res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({jsonrpc:'2.0',id:message.id,result}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const client=new T3McpClient({url:`http://127.0.0.1:${server.address().port}/mcp`,headers:{Authorization:'Bearer fixture-only'}});
    const tools=await client.initialize();
    assert.deepEqual(tools.map(t=>t.name),['delegate_task']);
    const result=await client.callTool('delegate_task',{task:'fixture'});
    assert.equal(result.content[0].text,'actual-child-id');
    await assert.rejects(client.callTool('request_secret',{}));
    assert.equal(callCount,1);
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
