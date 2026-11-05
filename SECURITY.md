# Security and dependency status

Do not submit API keys, bearer tokens, home-directory account files or full conversation dumps in public issues. Reproduction steps can use the included local fixtures. Step Code and T3 credentials stay in their existing stores.

## Fixes in v0.2.2

- Pins Zod 4.6.7, which includes the fix for [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). The pinned ACP SDK 0.26.0 already imports `zod/v4`; pi-acp's bundled runtime has no direct Zod import. The explicit override is checked through schema, ACP and MCP regression tests rather than an untested automatic major upgrade.
- Generates a private copy of the pinned ACP SDK with payload-free diagnostics. Invalid messages and failed requests no longer print raw requests or error objects. The original dependency and its license remain intact.
- Omits raw Step Code RPC stderr instead of applying chunk-based token regular expressions. A fixed diagnostic notice remains visible. Interactive terminal authentication still opens Step Code's own UI; its behavior is controlled by Step Code.
- Bounds incoming ACP messages to 8 MiB per JSONL frame, a nesting depth of 64, 4,096 entries per collection, and 20,000 total values before SDK validation. Malformed frames are discarded, oversized byte frames are discarded through the next newline, and structurally oversized requests receive an error. The connection can accept the next valid frame.

Security fixtures use fake credentials and no model access. They cover malformed input, oversized collections, nesting, byte limits, failed requests, split stderr credentials, and failure propagation. CI also checks dependency advisories and public files/metadata. These are focused safeguards, not a complete security audit or a guarantee against every resource-exhaustion attack.

The adapter is a local child process, not a public network service. Run it only with trusted clients, Step Code installations and projects. Project content, prompts and tool results can be sent to the model providers configured in Step Code and any explicitly delegated T3 tasks. This project adds no hosted proxy or analytics service. Do not expose T3's local MCP endpoint or share its session-scoped bearer token.

Earlier releases retain their original behavior. Upgrade to v0.2.2 or later for these fixes; do not assume a source update changes an already extracted archive.
