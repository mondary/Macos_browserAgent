const MAX_ELEMENTS = 120;
const MAX_VISIBLE_TEXT_LENGTH = 12000;
const interactiveSelector = [
  "a[href]",
  "button",
  "input",
  "textarea",
  "select",
  "[role='button']",
  "[role='link']",
  "[role='menuitem']",
  "[role='option']",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

let latestSnapshotMap = new Map();

function isVisible(element) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.visibility === "hidden" || style.display === "none") {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getElementText(element) {
  const label =
    element.getAttribute("aria-label") ||
    element.getAttribute("title") ||
    element.getAttribute("placeholder") ||
    element.getAttribute("alt") ||
    "";

  const text = (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
  return (text || label).slice(0, 160);
}

function getElementValue(element) {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
    return undefined;
  }

  if (element instanceof HTMLInputElement && element.type === "password") {
    return "[hidden]";
  }

  return String(element.value ?? "").slice(0, 200);
}

function buildSnapshot() {
  const elements = [];
  latestSnapshotMap = new Map();

  const candidates = [...document.querySelectorAll(interactiveSelector)]
    .filter(isVisible)
    .slice(0, MAX_ELEMENTS);

  candidates.forEach((element, index) => {
    const rect = element.getBoundingClientRect();
    const id = index + 1;
    latestSnapshotMap.set(id, element);
    elements.push({
      elementId: id,
      tag: element.tagName.toLowerCase(),
      role: element.getAttribute("role") || null,
      type: element instanceof HTMLInputElement ? element.type || "text" : null,
      text: getElementText(element),
      name: element.getAttribute("name") || null,
      placeholder: element.getAttribute("placeholder") || null,
      ariaLabel: element.getAttribute("aria-label") || null,
      href: element instanceof HTMLAnchorElement ? element.href : null,
      value: getElementValue(element),
      disabled: "disabled" in element ? Boolean(element.disabled) : false,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    });
  });

  const visibleText = (document.body?.innerText || "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, MAX_VISIBLE_TEXT_LENGTH);

  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  return {
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: Math.round(window.scrollX),
      scrollY: Math.round(window.scrollY)
    },
    activeElement: active
      ? {
          tag: active.tagName.toLowerCase(),
          text: getElementText(active),
          ariaLabel: active.getAttribute("aria-label") || null
        }
      : null,
    visibleText,
    elements
  };
}

function dispatchInputEvents(element) {
  element.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

async function performAction(action) {
  switch (action.type) {
    case "click": {
      const element = latestSnapshotMap.get(action.elementId);
      if (!element) {
        throw new Error(`Element ${action.elementId} not found in current snapshot.`);
      }
      element.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      await new Promise((resolve) => setTimeout(resolve, 150));
      element.click();
      return { ok: true, action, result: "clicked" };
    }
    case "type": {
      const element = latestSnapshotMap.get(action.elementId);
      if (!element) {
        throw new Error(`Element ${action.elementId} not found in current snapshot.`);
      }
      if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement || element.isContentEditable)) {
        throw new Error(`Element ${action.elementId} is not editable.`);
      }
      element.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      element.focus();
      if (element.isContentEditable) {
        element.textContent = action.text;
      } else {
        element.value = action.text;
      }
      dispatchInputEvents(element);
      return { ok: true, action, result: "typed" };
    }
    case "scroll": {
      const amount = Number.isFinite(action.amount) ? action.amount : Math.round(window.innerHeight * 0.8);
      const delta = action.direction === "up" ? -Math.abs(amount) : Math.abs(amount);
      window.scrollBy({ top: delta, behavior: "smooth" });
      await new Promise((resolve) => setTimeout(resolve, 300));
      return { ok: true, action, result: `scrolled ${delta}` };
    }
    case "keypress": {
      const target = action.elementId ? latestSnapshotMap.get(action.elementId) : document.activeElement || document.body;
      if (!(target instanceof HTMLElement)) {
        throw new Error("No valid target for keypress.");
      }
      target.focus?.();
      const eventOptions = { key: action.key, bubbles: true, composed: true };
      target.dispatchEvent(new KeyboardEvent("keydown", eventOptions));
      target.dispatchEvent(new KeyboardEvent("keyup", eventOptions));
      return { ok: true, action, result: `pressed ${action.key}` };
    }
    case "wait": {
      const waitMs = Math.max(100, Number(action.waitMs) || 500);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return { ok: true, action, result: `waited ${waitMs}ms` };
    }
    case "go_back": {
      history.back();
      return { ok: true, action, result: "went back" };
    }
    default:
      throw new Error(`Unsupported action type: ${action.type}`);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case "ping":
        sendResponse({ ok: true });
        break;
      case "snapshot":
        sendResponse(buildSnapshot());
        break;
      case "perform_action":
        sendResponse(await performAction(message.action));
        break;
      case "go_back":
        sendResponse(await performAction({ type: "go_back" }));
        break;
      default:
        sendResponse({ ok: false, error: `Unknown content script message: ${message.type}` });
    }
  })().catch((error) => {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error."
    });
  });

  return true;
});
