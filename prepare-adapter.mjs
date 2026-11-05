import { readFile, writeFile, mkdir, chmod, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const [nodeMajor,nodeMinor,nodePatch] = process.versions.node.split('.').map(Number);
if (nodeMajor < 24 || (nodeMajor === 24 && (nodeMinor < 22 || (nodeMinor === 22 && nodePatch < 2)))) {
  throw new Error('Node.js 24.22.2 or newer is required. Select an updated Node LTS runtime before building.');
}

const root = dirname(fileURLToPath(import.meta.url));
const generated = join(root, '.generated');
const bin = join(root, 'bin');
await mkdir(generated, { recursive: true });
await mkdir(bin, { recursive: true });
// Keep the original SDK installed and licensed. Generate a private runtime copy
// with payload-free diagnostics rather than changing console behavior globally.
const sdkRoot = join(root, 'node_modules/@agentclientprotocol/sdk');
const sdkVersion = JSON.parse(await readFile(join(sdkRoot, 'package.json'), 'utf8')).version;
if (sdkVersion !== '0.26.0') throw new Error('Review SDK security patches before changing its version');
const safeSdk = join(generated, 'acp-sdk');
await rm(safeSdk, {recursive:true, force:true});
await cp(join(sdkRoot, 'dist'), safeSdk, {recursive:true});
await cp(join(sdkRoot, 'LICENSE'), join(safeSdk, 'LICENSE'));
let sdkSource = await readFile(join(safeSdk, 'acp.js'), 'utf8');
for (const before of [
  'console.error("Unexpected error during message processing:", message, err);',
  'console.error("Error handling request", message, response.error);',
  'console.error("Error handling notification", message, response.error);',
  'console.error("Invalid message", { message });',
  'console.error("Got response to unknown request", response.id);',
]) {
  if (!sdkSource.includes(before)) throw new Error('SDK diagnostic patch no longer matches');
  sdkSource = sdkSource.replace(before, 'console.error("ACP request failed; diagnostic payload omitted.");');
}
await writeFile(join(safeSdk, 'acp.js'), '// Modified for payload-free diagnostics; see THIRD_PARTY_NOTICES.md.\n' + sdkSource);
await writeFile(join(safeSdk, 'stream.js'), '// Local bounded transport; original SDK license retained in this directory.\nexport { ndJsonStream } from "../../acp-transport.mjs";\n');
let source = await readFile(join(root, 'node_modules/pi-acp/dist/index.js'), 'utf8');
const version = JSON.parse(await readFile(join(root, 'node_modules/pi-acp/package.json'), 'utf8')).version;
if (version !== '0.0.34') throw new Error('Review compatibility patches before changing pi-acp version');
function patch(before, after) {
  if (!source.includes(before)) throw new Error('Upstream adapter changed; cannot apply patch: ' + before.slice(0, 70));
  source = source.replace(before, after);
}

// Keep the upstream adapter and its license. Forward only session-scoped local
// T3 HTTP MCP configuration through the child environment, never a config file.
patch('mcpCapabilities: { http: false, sse: false },', 'mcpCapabilities: { http: true, sse: false },');
patch('const args = ["--mode", "rpc", "--no-themes"];',
  'const args = ["--mode", "rpc", "--no-themes"];\n    if (params.mcpServers?.some(server => server.name === "t3-code")) args.push("--extension", stepAdapterFileURLToPath(new URL("t3-mcp-extension.mjs", stepAdapterRoot)));');
patch('env: process.env\n    });',
  'env: { ...process.env, STEP_CODE_T3_MCP_SERVERS: JSON.stringify(params.mcpServers ?? []) }\n    });');
patch('cwd: params.cwd,\n        piCommand: params.piCommand',
  'cwd: params.cwd,\n        mcpServers: params.mcpServers,\n        piCommand: params.piCommand');
patch('cwd,\n          sessionPath: stored.sessionFile,',
  'cwd,\n          mcpServers: opts?.mcpServers ?? [],\n          sessionPath: stored.sessionFile,');
patch('child.stderr.on("data", () => {\n    });', `let reportedDiagnostic = false;
    child.stderr.on("data", () => {
      if (!reportedDiagnostic) process.stderr.write("Step Code emitted diagnostic output; content omitted for privacy.\\n");
      reportedDiagnostic = true;
    });`);
source = source.replaceAll('from "@agentclientprotocol/sdk"', 'from "./acp-sdk/acp.js"');
source = source.replaceAll('pi process exited', 'Step Code process exited').replaceAll('pi returned a thinking level', 'Step Code returned a thinking level');
patch('name: pkg.name ?? "pi-acp",', 'name: "step-code-acp",');
patch('title: "pi ACP adapter",', 'title: "Step Code (local ACP adapter)",');
patch('return join(homedir(), ".pi", "pi-acp");', 'return process.env.STEP_CODE_ACP_HOME || join(homedir(), ".stepcode", "t3-acp");');
patch('name: "Launch pi in the terminal",', 'name: "Open Step Code in a terminal",');
patch('label: "Launch pi"', 'label: "Open Step Code"');
patch('const isJs = argv1.endsWith(".js");', 'const isJs = /\\.(?:mjs|cjs|js)$/.test(argv1);');
patch('return { command: "pi-acp", args: ["--terminal-login"] };', 'return { command: "step-code-acp", args: ["--terminal-login"] };');
patch('description: "Start pi in an interactive terminal to configure API keys or login",',
      'description: "Open the installed Step Code CLI to configure its account",');
source = source.replaceAll('".pi"', '".stepcode"');
patch(`const quietStartup = getQuietStartup(params.cwd);
    const updateNotice = buildUpdateNotice();
    const preludeText = quietStartup ? updateNotice ? updateNotice + "\\n" : "" : buildStartupInfo({
      cwd: params.cwd,
      fileCommands,
      updateNotice
    });`, 'const preludeText = "Step Code · local ACP compatibility adapter\\n";');
patch('const rl = readline.createInterface({ input: child.stdout });', `const rl = {
      on(_event, callback) {
        let text = "";
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", chunk => {
          text += chunk;
          let end;
          while ((end = text.indexOf("\\n")) !== -1) {
            const line = text.slice(0, end).replace(/\\r$/, "");
            text = text.slice(end + 1);
            callback(line);
          }
        });
      }
    };`);
patch('this.cancelRequested = false;\n    this.inAgentLoop = false;\n    this.pendingTurn',
      'this.cancelRequested = false;\n    this.stepFailure = null;\n    this.inAgentLoop = false;\n    this.pendingTurn');
patch('case "message_update": {', `case "message_end": {
        const message = ev.message;
        if (message?.role === "assistant" && message.errorMessage && message.stopReason !== "aborted") {
          this.stepFailure = String(message.errorMessage);
        }
        break;
      }
      case "message_update": {`);
patch('async settleTurn() {', 'async settleTurn(event = {}) {');
patch('this.pendingTurn?.resolve(reason);\n    this.pendingTurn = null;', `const failure = event.failure || this.stepFailure;
    if (failure && !this.cancelRequested) {
      this.pendingTurn?.reject(RequestError2.internalError({}, typeof failure === "string" ? failure : JSON.stringify(failure)));
    } else {
      this.pendingTurn?.resolve(reason);
    }
    this.pendingTurn = null;`);
patch('void this.settleTurn();', 'void this.settleTurn(ev);');
patch('this.pendingTurn?.resolve(reason);\n        }', 'if (this.cancelRequested) this.pendingTurn?.resolve("cancelled");\n          else this.pendingTurn?.reject(RequestError2.internalError({}, String(err?.message ?? err)));\n        }');

source = source.replace('#!/usr/bin/env node\n', `// Derived from pi-acp ${version} (MIT); see node_modules/pi-acp/LICENSE.
import { fileURLToPath as stepAdapterFileURLToPath } from 'node:url';
import { dirname as stepAdapterDirname } from 'node:path';
const stepAdapterRoot = new URL('../', import.meta.url);
process.env.PI_ACP_PI_COMMAND = stepAdapterFileURLToPath(new URL('bin/step-code-rpc', stepAdapterRoot));
process.env.PATH = stepAdapterDirname(process.execPath) + ':' + (process.env.PATH || '');
`);
await writeFile(join(generated, 'adapter.mjs'), source);
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
for (const [name, target] of [['step-code-acp', join(generated, 'adapter.mjs')], ['step-code-rpc', join(root, 'step-rpc.mjs')]]) {
  const file = join(bin, name);
  await writeFile(file, `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(target)} "$@"\n`);
  await chmod(file, 0o755);
}
console.log('Built Step Code ACP launchers with ' + process.execPath);
