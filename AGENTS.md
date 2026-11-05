# Contributor instructions

- Write all public-facing content in natural English, including documentation, diagrams, commit messages, release notes, issues, and pull requests. Add translations only when explicitly requested.
- Maintain `README.zh-CN.md` as the dedicated Chinese guide. Keep the main README and all other public content in English. Do not add setup diagrams.
- Integrate through ACP and the official ACP Registry. Do not patch T3 frontend bundles or add branded app launchers.
- Keep stdout valid ACP JSONL. Send diagnostics to stderr and never log credentials.
- Preserve upstream licenses and report only capabilities that have been verified.
- Run `npm run build` and `npm test` for adapter or distribution changes. Use real-model smoke tests only when the change needs them.
- Before publication, review credential handling, diagnostics, trust boundaries, approvals, dependency advisories, and capability claims. Add regression coverage for security fixes and test the extracted release artifacts.
- Run `npm run audit:public` and `npm audit --omit=dev --audit-level=moderate` before publishing. These checks supplement manual review; do not describe them as a complete security audit.
- Use neutral public branch names and omit incidental development-tool metadata. Preserve required notices and truthful technical references.
