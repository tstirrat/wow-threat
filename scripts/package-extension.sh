#!/usr/bin/env bash
# Builds the Chrome Web Store upload zip for packages/chrome-extension.
# Output: dist/wow-threat-extension-<manifest version>.zip
# Only runtime files are included (no README or store promo assets).
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ext="$root/packages/chrome-extension"
version="$(node -p "require('$ext/manifest.json').version")"
out="$root/dist/wow-threat-extension-$version.zip"

files=(manifest.json content.js popup.html popup.js assets/store-icon.png)

rm -rf "$root/dist/extension" "$out"
mkdir -p "$root/dist/extension/assets"
for f in "${files[@]}"; do cp "$ext/$f" "$root/dist/extension/$f"; done
(cd "$root/dist/extension" && zip -q -X "$out" "${files[@]}")

echo "$out"
unzip -l "$out"
