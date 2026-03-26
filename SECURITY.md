# Security Policy

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security bugs via [GitHub's private vulnerability reporting](../../security/advisories/new). This keeps the details confidential until a fix is ready.

Include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional)

You can expect an acknowledgement within 72 hours.

## Scope

Nichinichi is a local-first application — all data lives on your own filesystem. There is no server, no authentication layer, and no cloud backend in the current release. The primary security concerns are:

- **AI API key handling**: keys are stored in `~/.nichinichi.yml` and never logged or transmitted except to the configured AI endpoint
- **`.quiet/` enforcement**: entries in `.quiet/` are excluded from indexing and AI context at the watcher and rebuild level, not just the UI
- **No remote code execution**: the app does not fetch or execute remote code
