# Security and dependency status

Do not submit API keys, bearer tokens, home-directory account files or full conversation dumps in public issues. Reproduction steps can use the included local fixtures. Step Code and T3 credentials stay in their existing stores.

This preview pins pi-acp 0.0.34 and its Zod 3 dependency. At preparation time, npm audit reports [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), an oversized-collection validation memory-exhaustion advisory, through that dependency. npm reports no compatible automatic fix for pi-acp. A major Zod replacement has not been validated and is not silently forced here. Track upstream updates and revalidate the checked build patches before upgrading. The adapter is intended as a local child process, not a public network service.

The optional frontend server binds only to 127.0.0.1 and serves assets from the installed T3 frontend, with a public health response containing its local checkout path and PID. It does not serve arbitrary filesystem paths, proxy the backend or expose credentials. Do not expose the helper port to a public network.
