# Releasing Nichinichi

## Overview

Releases are built automatically by GitHub Actions when a version tag is pushed.
The workflow produces signed platform installers, attaches them to a draft GitHub
Release, and publishes `latest.json` to GitHub Pages so existing installs can
detect and apply the update from within the app.

Platforms built:

| Platform | Installer | Runner |
|---|---|---|
| macOS (Apple Silicon) | `.dmg` + `.app.tar.gz` | `macos-latest` (`aarch64`) |
| macOS (Intel) | `.dmg` + `.app.tar.gz` | `macos-latest` (cross-compiled) |
| Windows | `.exe` (NSIS) + `.exe.zip` | `windows-latest` |
| Linux (Debian/Ubuntu) | `.deb` | `ubuntu-22.04` |
| Linux (universal) | `.AppImage` | `ubuntu-22.04` |

---

## One-Time Setup

These steps are required once before the first release. They configure the
signing key used to authenticate update packages delivered to existing installs.

### 1. Generate the signing keypair

```sh
npx tauri signer generate -w ~/.tauri/nichinichi.key
```

This creates two files:
- `~/.tauri/nichinichi.key` — private key (never commit this)
- `~/.tauri/nichinichi.key.pub` — public key (goes in `tauri.conf.json`)

### 2. Set the public key in tauri.conf.json

Open [apps/desktop/src-tauri/tauri.conf.json](../apps/desktop/src-tauri/tauri.conf.json)
and replace the `PLACEHOLDER` in `plugins.updater.pubkey` with the full contents
of `~/.tauri/nichinichi.key.pub`:

```json
"plugins": {
  "updater": {
    "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXkgQ...",
    "endpoints": ["https://fetchflow.github.io/nichinichi/latest.json"],
    "dialog": false
  }
}
```

Commit this change — the public key is safe to store in the repo.

### 3. Add GitHub Actions secrets

In the GitHub repository, go to **Settings → Secrets and variables → Actions**
and add:

| Secret | Value |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Full contents of `~/.tauri/nichinichi.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Passphrase used during key generation (empty string if none) |

These are injected into the `Build and release` step so each artifact is signed
before upload.

### 4. Enable GitHub Pages

In the GitHub repository, go to **Settings → Pages** and set:
- Source: **Deploy from a branch**
- Branch: `gh-pages`, folder `/`

The `publish-update` CI job creates and updates this branch automatically on
each release. The published URL `https://fetchflow.github.io/nichinichi/latest.json`
is what the app polls to detect new versions.

---

## Cutting a Release

With the one-time setup complete, every release is a single command:

```sh
make release RELEASE_VERSION=v0.2.0
```

This command:
1. Updates the version in `Cargo.toml`, `apps/desktop/package.json`, and
   `apps/desktop/src-tauri/tauri.conf.json`
2. Runs `cargo check` to catch compilation errors before tagging
3. Commits the version bump as `chore: release v0.2.0`
4. Creates and pushes the `v0.2.0` tag, which triggers the release workflow

### What happens in CI

The `.github/workflows/release.yml` workflow runs two jobs:

**`build` (matrix, 4 platforms in parallel)**
- Bumps versions from the tag name (idempotent with the local bump)
- Builds and signs the desktop installer for each platform
- Uploads installers and `.sig` signature files as assets on a draft GitHub Release
- Builds and uploads the `nichinichi` CLI binary for each platform

**`publish-update` (runs after all `build` jobs succeed)**
- Downloads the release asset manifest
- Constructs `latest.json` with the new version, release notes URL, and
  per-platform download URLs + signatures
- Force-pushes `latest.json` to the `gh-pages` branch

### After CI completes

1. Go to **Releases** on GitHub
2. Review the draft release and edit the release notes if needed
3. Click **Publish release**

Existing installs will detect the update the next time the user opens Settings.

---

## How In-App Updates Work

When the user opens the **Settings** view, the app:

1. Calls the `check_for_update` Tauri command
2. The command fetches `https://fetchflow.github.io/nichinichi/latest.json`
3. If the version in `latest.json` is newer than the running app, the Settings
   page shows an **"Update to vX.Y.Z — Install & Restart"** button
4. Clicking the button calls `install_update`, which downloads the platform
   package, verifies the Ed25519 signature against the public key in
   `tauri.conf.json`, applies the update, and restarts the app

The signature check is mandatory — packages without a valid signature are
rejected. This prevents tampered updates from being applied.

---

## Pre-release / Release Candidate

```sh
git tag v0.2.0-rc1
git push origin v0.2.0-rc1
```

In the draft release UI, check **Set as a pre-release** before publishing.
Pre-release builds are not served via `latest.json`, so existing stable installs
will not be offered the update automatically.

---

## Manual / Test Build

Trigger a build without creating a release via `workflow_dispatch`:

1. Go to **Actions → Release → Run workflow**
2. Select the branch and click **Run workflow**

No release is created. Artifacts are available from the workflow run summary
for 90 days. These builds are unsigned (no tag, so `TAURI_SIGNING_PRIVATE_KEY`
is not used) and cannot be delivered as updates.

---

## Hotfix Process

```sh
git checkout v0.2.0
git checkout -b hotfix/v0.2.1
# apply fix, then:
make release RELEASE_VERSION=v0.2.1
```

After CI completes and the release is published, `latest.json` is updated and
users on v0.2.0 will be offered the patch automatically.

---

## Local Production Build (No CI)

To build a signed installer locally for testing:

```sh
export TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/nichinichi.key)
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=   # omit if no passphrase
cd apps/desktop && pnpm tauri build
```

Output lands in `target/release/bundle/` at the workspace root:

```
target/release/bundle/
├── dmg/          # macOS .dmg
├── macos/        # macOS .app + .app.tar.gz + .app.tar.gz.sig
├── nsis/         # Windows .exe + .exe.zip + .exe.zip.sig
├── deb/          # Linux .deb
└── appimage/     # Linux .AppImage + .AppImage.sig
```

The `.sig` files are the signatures used in `latest.json`.

---

## Versioning Scheme

Nichinichi follows [Semantic Versioning](https://semver.org/):

| Part | When to bump |
|---|---|
| `MAJOR` | Breaking changes to file formats or CLI interface |
| `MINOR` | New features, backward-compatible |
| `PATCH` | Bug fixes only |

During initial development (`0.x`), minor bumps may include breaking changes.
