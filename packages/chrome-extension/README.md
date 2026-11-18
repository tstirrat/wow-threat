# WoW Threat — Chrome Extension

Injects a **Threat** tab button into Warcraft Logs report pages that opens the current fight in [wow-threat.web.app](https://wow-threat.web.app).

## Installing (load unpacked)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `packages/chrome-extension/` directory from this repo

The extension icon will appear in your toolbar.

## Usage

Navigate to any WCL report page (classic, vanilla, fresh, forever, SoD, or retail). A **Threat** tab appears in the report's tab bar. Clicking it opens the current fight with the selected player pre-filled in wow-threat.

## Switching to localhost

Click the extension icon to open the popup. Click **Switch to Localhost :5173** to point all Threat links at your local dev server. Click again to switch back to production.

## Supported sites

- `classic.warcraftlogs.com`
- `vanilla.warcraftlogs.com`
- `forever.warcraftlogs.com`
- `fresh.warcraftlogs.com`
- `sod.warcraftlogs.com`
- `www.warcraftlogs.com`
