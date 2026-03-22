# App Icon Setup

This document explains how to create and apply a custom icon for the Nichinichi desktop app.

## Quick start

1. **Prepare a 1024×1024 PNG** — the source image Tauri uses to generate all platform sizes
2. Run: `cd apps/desktop && pnpm tauri icon src-tauri/icons/source.png`
3. Enable bundling in `tauri.conf.json` (see below)

---

## Source image

The icon is the kanji 日 (day/sun) — a geometric SVG with no font dependency:

- Background: dark navy `#1a1a2e`, rounded square (rx=220)
- Glyph: warm amber/orange `#f0923e`, rendered as filled rectangles
- Source: `apps/desktop/src-tauri/icons/source.svg`
- Rasterized: `apps/desktop/src-tauri/icons/source.png` (1024×1024)

---

## Step 1 — Convert SVG to PNG (if starting from SVG)

**Using Inkscape (installed):**
```sh
inkscape apps/desktop/src-tauri/icons/source.svg \
  --export-type=png --export-width=1024 \
  --export-filename=apps/desktop/src-tauri/icons/source.png
```

**Using ImageMagick:**
```sh
magick -background none apps/desktop/src-tauri/icons/source.svg \
  -resize 1024x1024 apps/desktop/src-tauri/icons/source.png
```

---

## Step 2 — Generate all icon sizes

```sh
cd apps/desktop
pnpm tauri icon src-tauri/icons/source.png
```

This writes to `apps/desktop/src-tauri/icons/`:
```
icons/
├── 32x32.png
├── 64x64.png
├── 128x128.png
├── 128x128@2x.png
├── icon.icns        # macOS
├── icon.ico         # Windows
├── icon.png         # Linux / tray fallback
└── Square*Logo.png  # Windows Store variants
```

---

## Step 3 — Enable bundling (required for icons to apply)

In `apps/desktop/src-tauri/tauri.conf.json`, set `bundle.active` to `true`:

```json
"bundle": {
  "active": true,
  "targets": "all",
  "icon": [
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.icns",
    "icons/icon.ico"
  ]
}
```

> **Note:** `bundle.active: false` is fine for `pnpm tauri dev`. Icons only fully apply in a production build (`pnpm tauri build`).

---

## Step 4 — Build and verify

```sh
cd apps/desktop
pnpm tauri build
```

The `.app` (macOS) or `.exe` (Windows) will use the new icon.

---

## Updating the tray icon separately

The tray icon is loaded at runtime from `icons/icon.png`. To use a separate tray icon:

1. Put a 32×32 or 64×64 PNG at `icons/tray-icon.png`
2. In `lib.rs`, update the `TrayIconBuilder` path accordingly

On macOS, suffix the filename with `Template` (e.g. `tray-iconTemplate.png`) for automatic dark/light mode switching.
