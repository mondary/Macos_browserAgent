# Codex Browser Agent

![Project icon](icon.png)

[🇬🇧 EN](README_en.md) · [🇫🇷 FR](README.md)

✨ Chrome MV3 extension with side panel to automate your browser via AI (Codex, Gemini, GLM).

## ✅ Features

- Integrated Chrome side panel for natural language queries
- Local HTTP bridge communicating with Codex CLI
- DOM snapshot + screenshot for page analysis
- Orchestration up to 8 reasoning steps per request
- Support for complex sites (Gmail, web applications)
- Flexible configuration via environment variables

## 🧠 Usage

### Start the bridge

```bash
# Default (Codex)
npm start

# Or choose a specific provider
npm run start:codex
npm run start:gemini
npm run start:glm
```

Optional environment variables:

```bash
# Bridge
BRIDGE_HOST=127.0.0.1
BRIDGE_PORT=7823

# AI CLI Provider (codex, gemini, glm)
AI_CLI=codex
AI_MODEL=gpt-5.4

# Optional: custom binaries
CODEX_BIN=codex
GEMINI_BIN=gemini
GLM_BIN=glm
```

### Load the Chrome extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` folder
5. Pin the extension for quick access
6. Click the extension to open the side panel

### Example queries

- `Read the first 5 visible email threads and give me a short digest.`
- `Open the first result on this page.`
- `Scroll until you find pricing, then summarize it.`
- `Click the "Sign up" button and fill the form.`

## 🧠 Architecture

```
extension/
├── manifest.json           # MV3 configuration
├── background.js           # Service worker
├── content-script.js       # DOM analysis
├── sidepanel.js/html/css   # User interface

bridge/
├── server.mjs              # Local HTTP server
├── agent-schema.json       # Configuration schema
```

## ⚙️ Configuration

The bridge listens by default on `127.0.0.1:7823` (localhost only).

### AI Providers

The bridge supports multiple CLI providers:

| Provider | AI_CLI variable | AI_MODEL variable  | Default binary |
|----------|-----------------|-------------------|----------------|
| Codex    | `codex`         | `gpt-5.4`         | `codex`        |
| Gemini   | `gemini`        | `gemini-2.0-flash`| `gemini`       |
| GLM      | `glm`           | `glm-4.7`         | `glm`          |

**Usage examples:**

```bash
# With Codex (default)
AI_CLI=codex AI_MODEL=gpt-5.4 npm run start:bridge

# With Gemini
AI_CLI=gemini AI_MODEL=gemini-2.0-flash npm run start:bridge

# With GLM
AI_CLI=glm AI_MODEL=glm-4.7 npm run start:bridge
```

### Available variables

- `BRIDGE_HOST`: Listen host (default: 127.0.0.1)
- `BRIDGE_PORT`: Listen port (default: 7823)
- `AI_CLI`: AI provider (`codex`, `gemini`, `glm`) - default: `codex`
- `AI_MODEL`: Model to use
- `CODEX_BIN`, `GEMINI_BIN`, `GLM_BIN`: Path to binaries

## ⚠️ Limitations

- Works only on pages where content scripts are allowed
- Uses compact DOM snapshot + screenshot, not full browser automation
- Side panel orchestrates up to 8 reasoning steps per request
- Gmail and other complex apps may still need iteration for optimal reliability

## 🧾 Changelog

### 0.2.0
- Multi-provider support: Codex, Gemini, GLM
- Unified environment variables (AI_CLI, AI_MODEL)
- NPM scripts for each provider
- Configuration refactor

### 0.1.0
- Initial release
- Chrome side panel support
- Local HTTP bridge with Codex CLI
- DOM snapshot + screenshot
- Multi-step orchestration

## 🔗 Links

- [FR README](README.md)
- Codex CLI: https://github.com/anthropics/codex
- Issue Tracker: https://github.com/votre-username/macos-browser-agent/issues
