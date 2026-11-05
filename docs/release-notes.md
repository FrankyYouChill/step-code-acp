Step Code ACP connects an installed Step Code CLI to ACP clients, including T3 Code.

- Removes the version-specific T3 frontend overlay and icon launchers. The main documentation is in English, with a separate Chinese guide.
- Removes the setup diagram and includes the documentation in release archives.
- Adds relocatable distribution archives with a bundled Node runtime and pinned dependencies. Step Code itself must be installed and configured separately.
- Includes terminal authentication metadata, the session-scoped T3 MCP bridge, and a monochrome Registry icon.
- Keeps T3's normal interface and authentication behavior. Local command entries may show T3's generic ACP icon; Registry branding depends on review and availability of the Registry entry.

These are community preview packages. Read the README, architecture notes, and dependency advisory before use. Registry submission is separate from acceptance and does not imply endorsement by StepFun or T3.
