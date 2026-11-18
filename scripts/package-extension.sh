#!/usr/bin/env bash
# Builds the Chrome Web Store upload zip for packages/chrome-extension.
# Output: dist/wow-threat-extension-<manifest version>.zip
# Only runtime files are included (no README or store promo assets).
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ext="$root/packages/chrome-extension"
version="$(node -p "require('$ext/manifest.json').version")"
out="$root/dist/wow-threat-extension-$version.zip"

mkdir -p "$root/dist"
rm -f "$out"
(cd "$ext" && zip -q -X "$out" manifest.json content.js popup.html popup.js assets/store-icon.png)

echo "$out"
unzip -l "$out"
