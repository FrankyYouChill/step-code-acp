# Contributor instructions

- Write all public-facing content in natural English, including documentation, diagrams, commit messages, release notes, issues, and pull requests. Add translations only when explicitly requested.
- Maintain `README.zh-CN.md` as the dedicated Chinese guide. Keep the main README and all other public content in English. Do not add setup diagrams.
- Integrate through ACP and the official ACP Registry. Do not patch T3 frontend bundles or add branded app launchers.
- Keep stdout valid ACP JSONL. Send diagnostics to stderr and never log credentials.
- Preserve upstream licenses and report only capabilities that have been verified.
- Run `npm run build` and `npm test` for adapter or distribution changes. Use real-model smoke tests only when the change needs them.
