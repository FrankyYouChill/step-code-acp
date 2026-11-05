Step Code ACP v0.2.3 connects an installed Step Code CLI to ACP clients, including T3 Code.

- Pins Zod 4.6.7 to address GHSA-mrhx-c7xc-m3w5 while retaining the SDK's existing `zod/v4` interface.
- Omits raw requests, error objects and Step Code RPC stderr from diagnostics, including malformed input and split credential writes.
- Bounds ACP input size, nesting and collection counts before schema validation, with regression coverage and recovery checks.
- Adds dependency-advisory and public-file/metadata checks to CI. Clarifies provider data flow and the limits of fixture validation.
- Updates the bundled runtime to Node 24.22.2, including the October 2026 Node security fixes. Source installs require Node 24.22.2 or newer; archive tests check the bundled executable version.
- Retains relocatable packages, terminal authentication and the session-scoped T3 MCP bridge. Step Code must be installed and configured separately.

These are community preview packages. Read the README, architecture notes and security notes before use. Earlier extracted archives are not updated automatically. Registry submission is separate from acceptance and does not imply endorsement by StepFun or T3. Full session recovery, cancellation, rollback and long-running delegation remain outside the verified lifecycle matrix.
