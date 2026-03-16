#!/usr/bin/env bash
# Workaround for Tauri DMG bundler bug (https://github.com/tauri-apps/tauri/issues/3055)
# Tauri's bundler fails to produce a clean DMG, leaving rw.* temp files.
# This script cleans up and runs bundle_dmg.sh manually after cargo tauri build.

set -euo pipefail

BUNDLE_DIR="apps/native/src-tauri/target/release/bundle"
MACOS_DIR="$BUNDLE_DIR/macos"
DMG_DIR="$BUNDLE_DIR/dmg"
APP_NAME="Hermes"

# Read version from tauri.conf.json
VERSION=$(node -e "console.log(require('./apps/native/src-tauri/tauri.conf.json').version)")
ARCH=$(uname -m)
if [[ "$ARCH" == "arm64" ]]; then
  ARCH="aarch64"
fi

DMG_NAME="${APP_NAME}_${VERSION}_${ARCH}.dmg"

# Check that the .app exists
if [[ ! -d "$MACOS_DIR/$APP_NAME.app" ]]; then
  echo "Error: $MACOS_DIR/$APP_NAME.app not found. Run native:build first."
  exit 1
fi

# Clean stale DMGs
rm -f "$MACOS_DIR"/*.dmg
rm -f "$DMG_DIR"/*.dmg 2>/dev/null || true

echo "Building DMG: $DMG_NAME"

cd "$DMG_DIR"
bash bundle_dmg.sh \
  --volname "$APP_NAME" \
  --window-pos 200 120 \
  --window-size 600 400 \
  --icon-size 100 \
  --app-drop-link 425 170 \
  --icon "$APP_NAME.app" 175 170 \
  "$DMG_NAME" \
  "../../$MACOS_DIR/$APP_NAME.app"

echo ""
echo "DMG ready: $DMG_DIR/$DMG_NAME"
