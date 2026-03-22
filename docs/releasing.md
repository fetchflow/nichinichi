# Releasing Nichinichi

## Overview

Releases are built automatically by GitHub Actions when a version tag is pushed.
The workflow produces platform installers and attaches them to a draft GitHub Release.

Platforms built:

| Platform | Installer | Runner |
|---|---|---|
| macOS (Apple Silicon) | `.dmg` | `macos-latest` (`aarch64`) |
| macOS (Intel) | `.dmg` | `macos-13` (`x86_64`) |
| Windows | `.exe` (NSIS) | `windows-latest` |
| Linux (Debian/Ubuntu) | `.deb` | `ubuntu-22.04` |
| Linux (universal) | `.AppImage` | `ubuntu-22.04` |

---

## Cutting a release

### 1. Bump the version

Version is declared in two places — update both:

```sh
# apps/desktop/src-tauri/tauri.conf.json
"version": "0.2.0"

# apps/desktop/src-tauri/Cargo.toml
version = "0.2.0"
```

Commit the bump:

```sh
git add apps/desktop/src-tauri/tauri.conf.json apps/desktop/src-tauri/Cargo.toml
git commit -m "chore: bump version to 0.2.0"
git push
```

### 2. Push a version tag

```sh
git tag v0.2.0
git push origin v0.2.0
```

This triggers the release workflow at `.github/workflows/release.yml`.

### 3. Monitor the build

Go to the **Actions** tab on GitHub and watch the `Release` workflow. All four
matrix jobs must pass. Build times are roughly:

- macOS: 15–25 min (Rust compile + DMG packaging)
- Windows: 15–20 min
- Linux: 10–15 min

### 4. Publish the draft release

Once all jobs succeed, a **draft release** is created under **Releases** on GitHub
with the installer assets attached. Review the assets, edit the release notes if
needed, then click **Publish release**.

---

## Pre-release / release candidate

To publish a pre-release without making it the latest:

```sh
git tag v0.2.0-rc1
git push origin v0.2.0-rc1
```

In the draft release UI, check **Set as a pre-release** before publishing.

---

## Manual / test build

Trigger a build without creating a release using `workflow_dispatch`:

1. Go to **Actions → Release → Run workflow**
2. Select the branch and click **Run workflow**

No release is created — artifacts are available for download from the workflow
run summary for 90 days.

---

## Hotfix process

1. Check out the tag you need to patch:
   ```sh
   git checkout v0.2.0
   git checkout -b hotfix/v0.2.1
   ```
2. Apply the fix, bump the patch version, commit
3. Merge into `main`
4. Tag and push:
   ```sh
   git tag v0.2.1
   git push origin v0.2.1
   ```

---

## Local production build (no CI)

To build an installer locally for testing:

```sh
cd apps/desktop
pnpm tauri build
```

Output lands in `target/release/bundle/` at the repo root (Cargo
workspace `target/` is always at the workspace root, not inside `src-tauri/`):

```
target/release/bundle/
├── dmg/          # macOS .dmg
├── macos/        # macOS .app
├── nsis/         # Windows .exe
├── deb/          # Linux .deb
└── appimage/     # Linux .AppImage
```

> macOS `.dmg` and notarization require Apple Developer credentials.
> For internal distribution, the raw `.app` can be zipped and shared directly.

---

## Versioning scheme

Nichinichi follows [Semantic Versioning](https://semver.org/):

| Part | When to bump |
|---|---|
| `MAJOR` | Breaking changes to file formats or CLI interface |
| `MINOR` | New features, backward-compatible |
| `PATCH` | Bug fixes only |

During initial development (`0.x`), minor bumps may include breaking changes.
