# Codex Browser Agent

Chrome extension MV3 with a side panel UI that sends natural-language requests to a local bridge, which then calls `codex exec` to decide the next browser actions.

## What is included

- `chrome-extension/`: loadable unpacked Chrome extension
- `bridge/server.mjs`: local HTTP bridge backed by Codex CLI
- `dist/chrome-extension.zip`: packaged extension bundle after `npm run package`
- `dist/macos-browser-agent-kit.zip`: packaged project bundle after `npm run package`

## Start the bridge

```bash
npm run start:bridge
```

Optional environment variables:

```bash
BRIDGE_HOST=127.0.0.1
BRIDGE_PORT=7823
CODEX_BIN=codex
CODEX_MODEL=gpt-5.4
```

## Load the extension

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select `chrome-extension/` or `dist/chrome-extension/`
5. Pin the extension if you want quick access
6. Click the extension action to open the side panel

## Test flow

1. Start the bridge
2. Open a normal webpage, for example Gmail or another app page
3. Open the side panel
4. Ask naturally, for example:
   - `Read the first 5 visible email threads and give me a short digest.`
   - `Open the first result on this page.`
   - `Scroll until you find pricing, then summarize it.`

## Current limits

- Works only on pages where content scripts are allowed
- Uses a compact DOM snapshot plus a screenshot, not full browser automation
- The side panel orchestrates up to 8 reasoning steps per request
- Gmail and other complex apps may still need iteration for higher reliability
