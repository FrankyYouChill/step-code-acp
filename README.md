# Step Code ACP

Use your installed **Step Code** CLI from **T3 Code** through the Agent Client Protocol (ACP).

**Community preview.** This is an independent compatibility adapter, not an official StepFun or T3 release. Built on [pi-acp 0.0.34](https://github.com/svkozak/pi-acp), with the upstream MIT notice retained. No API keys, account configuration, conversations, or T3 application files are included in this repository.

[中文使用说明](README.zh-CN.md) · [Limitations and architecture](docs/architecture.md) · [Registry submission path](docs/registry.md)

```text
T3 Code → ACP adapter → installed Step Code (--mode rpc) → your existing Step Code provider
```

The actual coding harness is Step Code. Choosing a Step model in OpenCode is a separate setup and remains the OpenCode harness.

## Install

Requires macOS or Linux, Node.js **24+**, npm, and an installed/configured [Step Code CLI](https://github.com/stepfun-ai/Step-Code). Run Step Code in a terminal first and confirm that your chosen model works. Your Step Plan or API access remains configured in Step Code; this adapter does not supply access or change billing.

```sh
git clone https://github.com/FrankyYouChill/step-code-acp.git
cd step-code-acp
node --version  # must be v24 or newer; if using nvm: nvm use 24
npm ci --ignore-scripts
npm run setup
```

Setup builds launchers with the absolute path of the Node runtime used during setup, then links `~/.local/bin/step-code-acp` to this checkout. **Keep the checkout in place.** Re-run setup after moving it or changing Node installations. An existing unrelated executable is preserved; the installer explains how to back it up and replace its link explicitly.

In T3: **Settings → Providers → Add provider → Show more → Local ACP command**.

| Field | Value |
| --- | --- |
| Display name | `Step Code` |
| Executable | The full path printed by setup, normally `/home/YOU/.local/bin/step-code-acp` (macOS: `/Users/YOU/.local/bin/step-code-acp`) |
| Arguments | Leave empty |
| Environment | Leave empty to reuse your Step Code configuration |

By default the installed CLI is `~/.stepcode/bin/step`. For another location, set `STEP_CODE_BINARY` to its full executable path in the T3 provider's environment settings. Model choices are reported by Step Code. Sign-in through the adapter opens the installed Step CLI; configuring Step Code first is the simplest route.

## Correct Step Code icon in T3 0.1.7 (optional, macOS)

Stock T3 0.1.7 gives local ACP commands a generic icon. Installing an ACP adapter alone does not change that frontend behavior.

This repository includes a **version-checked local frontend overlay**. It reads assets from your own installed T3 application, replaces the shared provider-icon rendering branch for the names in `branding.json`, and serves those assets only on `127.0.0.1:4318`. It uses T3's existing `VITE_DEV_SERVER_URL` development frontend override. **It does not modify the installed app, its signature, authentication, your provider settings, or conversation records. It does not redistribute T3 assets.** The backend remains the installed T3 backend, with the original T3 home explicitly selected.

1. Verify compatibility: `npm run t3:check`.
2. Finish any active T3 work and **Quit T3** from its application menu.
3. Run `npm run t3:launch`, or open the generated **T3 with Step Code.app** in this checkout. The Finder launcher requires Apple Command Line Tools at setup time; the npm command does not.
4. Use the local ACP provider named **Step Code**. Its sidebar, composer and provider-picker icon use the supplied Step mark. Native providers such as OpenCode retain their own identity.

The development override can show T3 development branding and uses a separate frontend browser-storage origin. Server-side threads/projects remain in your selected T3 home. The launcher defaults to `/Applications/T3 Code (Beta).app`, T3 home `~/.t3`, backend port `3773`. Override with `T3_APP_PATH`, `T3CODE_HOME`, or `T3CODE_PORT` when needed. Port `4318` must be free. The overlay deliberately refuses an unverified T3 bundle, even if it reports the same version.

**Restore:** Quit T3, run `npm run t3:stop`, then open T3 normally from Applications. The original app and ACP connection continue to work; stock local-command icons return. Do not stop the overlay while recording or using its T3 window.

The logo is an identification asset supplied by the project owner from [this GitHub avatar](https://avatars.githubusercontent.com/u/178004800?s=256&v=4). Brand assets are excluded from the MIT code license; no ownership of the mark is claimed.

## T3 delegation

The adapter forwards T3's **session-scoped local MCP connection** into an explicitly loaded Step Code extension. Step Code can call T3's capability, delegation and thread-coordination tools when the connected T3 version exposes them. This enables a real Step Code parent to delegate to other T3 providers, including OpenCode. Those children are T3-managed tasks, not Step-native subagents.

The bridge accepts only the local `t3-code` endpoint, supports T3 0.1.7's `acp-mcp-bridge` descriptor without executing its supplied command, keeps its bearer token in process memory, and does not copy it into project files or logs. T3 and Step Code still own their tool approval behavior.

## Verify

```sh
npm test                   # local fixtures; no model spend
npm run smoke              # real model read/write; uses your Step Code access
npm run smoke:mcp -- --stdio-descriptor  # real model + local MCP fixture
```

Real smoke tests create disposable temporary workspaces and approve a single fixture write. They do not rerun your projects. Real T3 delegation needs an additional end-to-end T3 session; a fixture is not proof that every T3 orchestration lifecycle works.

Locally verified on 2026-11-05 with macOS, Node 24.15.0, T3 Code 0.1.7, Step Code 0.1.6 and Step 5 Preview. Linux support is implementation-level and has not received the same desktop validation. Resume, rollback, long-running cancellation and multi-agent lifecycle handling need more coverage; free-text input/editor requests are currently unsupported. See [architecture](docs/architecture.md) and [dependency advisory](SECURITY.md).

## Uninstall

Restore the standard T3 frontend as described above, then run `npm run uninstall`. It removes only the executable link owned by this checkout. Step Code credentials, native sessions and T3 history remain. Once no client uses this checkout, you can remove it yourself.

## Contributing

Issues and PRs are welcome. Keep protocol output on stdout valid JSONL; diagnostics belong on stderr. Do not commit credentials, home-directory settings, generated launchers or conversation logs. Preserve upstream notices and keep advertised capabilities honest. GitHub installation works today without Registry approval; Registry inclusion and native T3 icon support are separate follow-ups.

Code: MIT. Upstream and brand notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
