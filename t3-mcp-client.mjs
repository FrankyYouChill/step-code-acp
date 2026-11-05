// Session-scoped Streamable HTTP MCP client. Credentials stay in process memory.
const PROTOCOL = '2025-06-18';
export const T3_TOOLS = new Set([
  'search', 'execute', 'tool_search', 'code_mode',
  'orchestrator_capabilities', 'delegate_task', 'task_status', 'task_cancel',
  't3_thread_list', 't3_thread_read', 't3_thread_send', 't3_thread_wait',
  't3_thread_configure', 't3_pending_request', 't3_thread_metadata_update',
]);

export function selectT3Servers(servers) {
  if (!Array.isArray(servers)) throw new Error('MCP servers must be an array');
  return servers.filter(server => server?.name === 't3-code').map(server => {
    let endpoint = server.url;
    const headers = {};
    if (!endpoint && Array.isArray(server.args) && server.args.includes('acp-mcp-bridge')) {
      // T3 0.1.7 supplies its scoped endpoint through an app-owned stdio
      // descriptor even when the ACP adapter advertises HTTP. Consume only
      // those two declared values; do not execute a supplied command.
      const declared = Object.fromEntries((server.env ?? []).map(item => [item.name,item.value]));
      endpoint = declared.T3_ACP_MCP_ENDPOINT;
      if (!endpoint || !declared.T3_ACP_MCP_AUTHORIZATION) throw new Error('Incomplete T3 stdio bridge descriptor');
      headers.Authorization = declared.T3_ACP_MCP_AUTHORIZATION;
    } else if (server.type !== 'http') throw new Error('Unsupported T3 MCP transport');
    const url = new URL(endpoint);
    if (url.protocol !== 'http:' ||
        !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
        url.pathname !== '/mcp' || url.username || url.password || url.search) {
      throw new Error('The Step Code T3 bridge only accepts the local T3 HTTP MCP endpoint');
    }
    for (const header of server.headers ?? []) {
      if (typeof header.name !== 'string' || typeof header.value !== 'string') throw new Error('Invalid MCP header');
      headers[header.name] = header.value;
    }
    return { url: url.href, headers };
  });
}

export class T3McpClient {
  constructor(server, { timeoutMs = 120000 } = {}) {
    this.server = server;
    this.timeoutMs = timeoutMs;
    this.nextId = 0;
    this.sessionId = null;
  }
  async request(method, params = {}, signal, notification = false) {
    const id = ++this.nextId;
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const headers = {
      ...this.server.headers,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': PROTOCOL,
      ...(this.sessionId ? {'Mcp-Session-Id': this.sessionId} : {}),
    };
    const response = await fetch(this.server.url, {
      method: 'POST', headers, signal: combined,
      body: JSON.stringify({jsonrpc:'2.0', ...(notification ? {} : {id}), method, params}),
      redirect: 'error',
    });
    if (!response.ok) throw new Error(`T3 MCP ${method} failed (HTTP ${response.status})`);
    const sessionId = response.headers.get('mcp-session-id');
    if (sessionId) this.sessionId = sessionId;
    if (notification || response.status === 204) {
      await response.body?.cancel();
      return null;
    }
    let payload;
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        outer: while (true) {
          const chunk = await reader.read();
          buffer = (buffer + decoder.decode(chunk.value, {stream:!chunk.done})).replace(/\r\n/g, '\n');
          let end;
          while ((end = buffer.indexOf('\n\n')) !== -1) {
            const event = buffer.slice(0,end); buffer = buffer.slice(end+2);
            const data = event.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
            if (!data) continue;
            let candidate;
            try { candidate = JSON.parse(data); } catch { continue; }
            if (candidate.id === id && (Object.hasOwn(candidate,'result') || candidate.error)) {
              payload = candidate;
              break outer;
            }
          }
          if (chunk.done) throw new Error(`T3 MCP ${method} closed before its response`);
        }
      } finally { await reader.cancel().catch(() => {}); }
    } else payload = await response.json();
    if (payload?.id !== id) throw new Error('Mismatched T3 MCP response');
    if (payload.error) throw new Error(`T3 MCP ${method}: ${String(payload.error.message ?? 'request failed')}`);
    return payload.result;
  }
  async initialize() {
    await this.request('initialize', {protocolVersion:PROTOCOL,capabilities:{},clientInfo:{name:'step-code-t3-local-bridge',version:'0.2.0'}});
    await this.request('notifications/initialized', {}, undefined, true);
    const tools = [];
    const seen = new Set();
    let cursor;
    do {
      const page = await this.request('tools/list', cursor === undefined ? {} : {cursor});
      tools.push(...(page.tools ?? []));
      if (page.nextCursor === undefined || page.nextCursor === null) break;
      if (seen.has(page.nextCursor)) throw new Error('Repeated T3 MCP tool-list cursor');
      seen.add(page.nextCursor); cursor = page.nextCursor;
    } while (true);
    const selected = tools.filter(tool => T3_TOOLS.has(tool.name));
    if (!selected.length) throw new Error('T3 returned no supported orchestration tools');
    return selected;
  }
  async callTool(name, args, signal) {
    if (!T3_TOOLS.has(name)) throw new Error('Tool is outside the T3 orchestration bridge');
    return this.request('tools/call', {name,arguments:args}, signal);
  }
}
