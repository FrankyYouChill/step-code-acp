import { T3McpClient, selectT3Servers } from './t3-mcp-client.mjs';

export default async function registerT3Bridge(step) {
  const raw = process.env.STEP_CODE_T3_MCP_SERVERS;
  // Consume the private launch transport; never put its bearer token into a file,
  // tool description, conversation, or subprocess environment after startup.
  delete process.env.STEP_CODE_T3_MCP_SERVERS;
  if (!raw) return;
  let servers;
  try { servers = selectT3Servers(JSON.parse(raw)); }
  catch (error) {
    step.registerTool({name:'t3_bridge_diagnostic',label:'T3 bridge unavailable',description:'The T3 bridge failed to initialize. Read this diagnostic before claiming orchestration works.',parameters:{type:'object',properties:{},additionalProperties:false},execute:async()=>({content:[{type:'text',text:String(error.message)}],details:{ready:false}})});
    return;
  }
  const registered = [];
  for (const server of servers) {
    const client = new T3McpClient(server);
    let catalog;
    try { catalog = await client.initialize(); }
    catch (error) {
      step.registerTool({name:'t3_bridge_diagnostic',label:'T3 bridge unavailable',description:'The T3 bridge failed to initialize. Read this diagnostic before claiming orchestration works.',parameters:{type:'object',properties:{},additionalProperties:false},execute:async()=>({content:[{type:'text',text:String(error.message)}],details:{ready:false}})});
      return;
    }
    for (const tool of catalog) {
      const name = `mcp__t3-code__${tool.name}`;
      step.registerTool({
        name,
        label: `T3 · ${tool.name}`,
        description: tool.description || `T3 orchestration: ${tool.name}`,
        // Step's MCP catalog uses the server JSON schema unchanged as well.
        parameters: tool.inputSchema,
        async execute(_callId, args, signal) {
          const result = await client.callTool(tool.name, args, signal);
          const content = (result.content ?? []).filter(block => block.type === 'text' || block.type === 'image');
          if (result.structuredContent && !content.length) content.push({type:'text',text:JSON.stringify(result.structuredContent)});
          if (result.isError) throw new Error(content.filter(block => block.type === 'text').map(block => block.text).join('\n') || 'T3 tool failed');
          return {content, details:{t3Tool:tool.name, ...(result.structuredContent ? {result:result.structuredContent} : {})}};
        },
      });
      registered.push(name);
    }
  }
  step.on('before_agent_start', event => ({
    systemPrompt: event.systemPrompt + '\n\nT3 orchestration bridge: These mcp__t3-code__ tools belong to the T3 app, not Step-native subagents. Use orchestrator_capabilities and delegate_task for visible T3 child agents. If T3 exposes search/execute wrappers instead of individual tools, use those wrappers to discover and invoke the same T3 operations. Child contexts receive only the explicit task. For async delegation, save the returned identities, finish independent work, then END YOUR TURN; T3 will resume you when children finish. Never busy-poll a running task or invent a child result. Do not read credentials or raw environment variables.\n',
  }));
  step.registerCommand('t3-bridge-status', {
    description: 'Show the local T3 bridge tool names (never credentials)',
    handler: async (_args, ctx) => ctx.ui.notify(`T3 bridge ready: ${registered.join(', ')}`, 'info'),
  });
}
