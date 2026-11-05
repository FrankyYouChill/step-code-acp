# Architecture and scope

`prepare-adapter.mjs` reads the pinned pi-acp 0.0.34 dependency and applies checked substitutions to generate `.generated/adapter.mjs`. It fails when expected upstream anchors disappear. It changes agent identity, configuration/session paths, JSONL framing, failure reporting and T3 MCP forwarding. Local launchers record the setup-time Node executable. No generated absolute paths are committed.

`step-rpc.mjs` starts the installed Step Code CLI. RPC mode keeps `confirm` approvals and denies unavailable noninteractive approvals; ACP confirm/select requests remain visible to the client. The adapter does not globally turn off tool approval.

`t3-mcp-client.mjs` accepts only the `t3-code` server at a loopback HTTP `/mcp` URL. It does not execute supplied stdio descriptor commands. `t3-mcp-extension.mjs` consumes the private launch transport, deletes its environment variable, discovers the allowed T3 tools, and exposes them to the running Step Code session. Other MCP servers are not activated by this bridge.

Normal adapter state uses `~/.stepcode/t3-acp/`; `STEP_CODE_ACP_HOME` can select an isolated mapping directory. Step Code itself still controls its own native state and credentials.

Distribution packages include a Node runtime and the pinned dependencies. Runtime asset paths resolve relative to the extracted package, so packages can be relocated without rebuilding. Step Code itself must be installed and configured separately. Registry metadata and the monochrome SVG icon live in `registry/step-code-acp/`.

## Known limits

- ACP v1 compatibility through pi-acp, not full ACP v2 feature parity.
- Upstream advertises session loading/listing/deletion; the complete lifecycle matrix has not been validated here.
- Free-text input/editor UI is unsupported and cancelled with a diagnostic.
- Basic real read/write and fixture MCP checks do not establish complete cancellation, recovery, rollback, or subagent lifecycle correctness.
- T3 owns the delegated tasks. Native harness lineage has no general portable mapping in this preview.
- Provider/model service errors remain errors; the adapter must not mark a failed turn successful.
- macOS is the validated platform; Windows is unsupported. Linux ACP paths are supported by the implementation but need user testing.
- Registry availability depends on review and merge by its maintainers. Check the Registry status document before expecting a searchable entry.
