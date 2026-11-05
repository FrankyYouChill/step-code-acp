// ACP JSONL transport with bounded input and diagnostics that contain no payloads.
export const INPUT_LIMITS = Object.freeze({bytes:8 * 1024 * 1024, depth:64, collection:4096, nodes:20000});

function withinLimits(value) {
  const pending = [[value, 0]];
  let nodes = 0;
  while (pending.length) {
    const [item, depth] = pending.pop();
    if (++nodes > INPUT_LIMITS.nodes || depth > INPUT_LIMITS.depth) return false;
    if (item !== null && typeof item === 'object') {
      const values = Object.values(item);
      if (values.length > INPUT_LIMITS.collection) return false;
      for (const child of values) pending.push([child, depth + 1]);
    }
  }
  return true;
}

export function ndJsonStream(output, input) {
  const encoder = new TextEncoder();
  let writes = Promise.resolve();
  function write(message) {
    const content = encoder.encode(JSON.stringify(message) + '\n');
    const current = writes.then(async () => {
      const writer = output.getWriter();
      try { await writer.write(content); }
      finally { writer.releaseLock(); }
    });
    writes = current.catch(() => {});
    return current;
  }
  const readable = new ReadableStream({
    async start(controller) {
      const reader = input.getReader();
      let chunks = [], bytes = 0, discarding = false;
      async function finish() {
        if (!bytes) return;
        const text = Buffer.concat(chunks, bytes).toString('utf8').trim();
        chunks = []; bytes = 0;
        if (!text) return;
        let message;
        try { message = JSON.parse(text); }
        catch { console.error('Invalid ACP JSON message; payload omitted.'); return; }
        if (!message || typeof message !== 'object' || Array.isArray(message) || message.jsonrpc !== '2.0' ||
            ('method' in message && typeof message.method !== 'string') ||
            ('id' in message && message.id !== null && typeof message.id !== 'string' && typeof message.id !== 'number')) {
          console.error('Invalid ACP envelope; payload omitted.');
          return;
        }
        if (!withinLimits(message)) {
          console.error('ACP message exceeds structural limits; payload omitted.');
          const id = message && (typeof message.id === 'string' || typeof message.id === 'number') ? message.id : null;
          await write({jsonrpc:'2.0', id, error:{code:-32602, message:'ACP message exceeds structural safety limits'}});
          return;
        }
        controller.enqueue(message);
      }
      try {
        while (true) {
          const {value, done} = await reader.read();
          if (done) break;
          const chunk = Buffer.from(value);
          let start = 0;
          while (start < chunk.length) {
            const end = chunk.indexOf(10, start);
            const part = chunk.subarray(start, end === -1 ? chunk.length : end);
            if (!discarding) {
              if (bytes + part.length > INPUT_LIMITS.bytes) {
                chunks = []; bytes = 0; discarding = true;
                console.error('ACP message exceeds byte limit; payload omitted.');
                await write({jsonrpc:'2.0', id:null, error:{code:-32700, message:'ACP message exceeds byte safety limit'}});
              } else if (part.length) { chunks.push(part); bytes += part.length; }
            }
            if (end === -1) break;
            if (discarding) discarding = false;
            else await finish();
            start = end + 1;
          }
        }
        if (!discarding) await finish();
        controller.close();
      } catch {
        controller.error(new Error('ACP transport closed'));
      } finally { reader.releaseLock(); }
    },
  });
  return {readable, writable:new WritableStream({write})};
}
