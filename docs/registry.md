# Public distribution and Registry

This GitHub repository is usable independently of Registry membership. Users install the checkout and add a local ACP command in T3 today.

Registry applications are Pull Requests to [agentclientprotocol/registry](https://github.com/agentclientprotocol/registry), reviewed by that project's maintainers. Follow its current [CONTRIBUTING.md](https://github.com/agentclientprotocol/registry/blob/main/CONTRIBUTING.md) and [FORMAT.md](https://github.com/agentclientprotocol/registry/blob/main/FORMAT.md).

Before submitting this preview:

1. Pick a stable agent ID and release a reproducible distribution through an accepted pinned binary, npx or uvx method. This project currently has only Git-checkout setup and does not claim to be an npm package release.
2. Provide `agent.json` with version, description, repository, authors, license URL and supported distribution.
3. Provide the required 16×16 monochrome `currentColor` SVG icon. The bundled avatar JPEG is useful for the local overlay but is **not** a compliant Registry SVG.
4. Verify authentication, startup and the supported protocol/capability matrix on a clean machine. Be explicit that this adapter relies on an installed Step Code CLI and existing account access.
5. Fork the Registry, add the entry, run its checks, and open a PR. This repository's existence does not imply approval or endorsement.

Native T3 local-provider custom icons are a separate upstream contribution to [pingdotgg/t3code](https://github.com/pingdotgg/t3code). A reusable icon field should be generic; avoid baking a Step Code agent-ID exception into T3's generic ACP adapter. The local overlay remains optional while that upstream capability is unavailable.
