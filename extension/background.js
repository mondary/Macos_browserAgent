const DEFAULT_BRIDGE_URL = "http://127.0.0.1:7823";

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  const { bridgeUrl } = await chrome.storage.local.get("bridgeUrl");
  if (!bridgeUrl) {
    await chrome.storage.local.set({ bridgeUrl: DEFAULT_BRIDGE_URL });
  }
});

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "ping" });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content-script.js"]
    });
    await delay(200);
  }
}

async function sendToActiveTab(message) {
  const tab = await getActiveTab();
  if (!tab?.id) {
    throw new Error("No active tab available.");
  }

  if (!tab.url || /^chrome:|^edge:|^about:/.test(tab.url)) {
    throw new Error("Navigate to a normal webpage first. Content scripts cannot run on browser internal pages.");
  }

  await ensureContentScript(tab.id);
  return chrome.tabs.sendMessage(tab.id, message);
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function getSnapshotWithRetry(retries = 8) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await sendToActiveTab({ type: "snapshot" });
    } catch (error) {
      lastError = error;
      await delay(350);
    }
  }
  throw lastError || new Error("Failed to collect page snapshot.");
}

async function captureVisibleTab() {
  try {
    return await chrome.tabs.captureVisibleTab(undefined, {
      format: "jpeg",
      quality: 60
    });
  } catch {
    return null;
  }
}

async function performBrowserAction(action) {
  const tab = await getActiveTab();
  if (!tab?.id) {
    throw new Error("No active tab available.");
  }

  switch (action.type) {
    case "open_url":
      await chrome.tabs.update(tab.id, { url: action.url });
      return { ok: true, action, result: "navigated" };
    case "go_back":
      return sendToActiveTab({ type: "go_back" });
    default:
      return sendToActiveTab({ type: "perform_action", action });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case "get_bridge_url": {
        const { bridgeUrl } = await chrome.storage.local.get("bridgeUrl");
        sendResponse({ bridgeUrl: bridgeUrl || DEFAULT_BRIDGE_URL });
        break;
      }
      case "set_bridge_url": {
        await chrome.storage.local.set({ bridgeUrl: message.bridgeUrl || DEFAULT_BRIDGE_URL });
        sendResponse({ ok: true });
        break;
      }
      case "get_page_context": {
        const tab = await getActiveTab();
        const snapshot = await getSnapshotWithRetry();
        const screenshotDataUrl = await captureVisibleTab();
        sendResponse({
          ok: true,
          page: {
            tabId: tab?.id ?? null,
            url: tab?.url ?? "",
            title: tab?.title ?? "",
            ...snapshot,
            screenshotDataUrl
          }
        });
        break;
      }
      case "perform_browser_action": {
        const result = await performBrowserAction(message.action);
        sendResponse({ ok: true, result });
        break;
      }
      default:
        sendResponse({ ok: false, error: `Unknown message type: ${message.type}` });
    }
  })().catch((error) => {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error."
    });
  });

  return true;
});
