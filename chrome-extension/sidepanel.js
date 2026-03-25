const MAX_STEPS = 8;
const state = {
  conversation: [],
  running: false,
  previousSteps: []
};

const elements = {
  chatLog: document.querySelector("#chat-log"),
  promptInput: document.querySelector("#prompt-input"),
  sendButton: document.querySelector("#send-button"),
  runStatus: document.querySelector("#run-status"),
  bridgeStatus: document.querySelector("#bridge-status"),
  bridgeUrl: document.querySelector("#bridge-url"),
  saveSettings: document.querySelector("#save-settings"),
  checkBridge: document.querySelector("#check-bridge"),
  settingsToggle: document.querySelector("#settings-toggle"),
  settingsPanel: document.querySelector("#settings-panel"),
  template: document.querySelector("#message-template")
};

function setStatus(text) {
  elements.runStatus.textContent = text;
}

function appendMessage(role, content) {
  const fragment = elements.template.content.cloneNode(true);
  const root = fragment.querySelector(".message");
  root.dataset.role = role;
  fragment.querySelector(".message-role").textContent = role === "user" ? "You" : "Codex";
  fragment.querySelector(".message-body").textContent = content;
  elements.chatLog.appendChild(fragment);
  elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
}

function sendRuntimeMessage(message) {
  return chrome.runtime.sendMessage(message);
}

async function getBridgeUrl() {
  const response = await sendRuntimeMessage({ type: "get_bridge_url" });
  return response.bridgeUrl;
}

async function setBridgeUrl(url) {
  await sendRuntimeMessage({ type: "set_bridge_url", bridgeUrl: url });
}

async function checkBridgeHealth() {
  const bridgeUrl = elements.bridgeUrl.value.trim() || (await getBridgeUrl());
  try {
    const response = await fetch(`${bridgeUrl}/health`);
    const payload = await response.json();
    if (!payload.ok) {
      throw new Error("Bridge returned an invalid response.");
    }
    elements.bridgeStatus.textContent = `Connected to ${payload.service} at ${bridgeUrl}`;
  } catch (error) {
    elements.bridgeStatus.textContent = error instanceof Error ? error.message : "Bridge check failed.";
  }
}

async function getPageContext() {
  const response = await sendRuntimeMessage({ type: "get_page_context" });
  if (!response.ok) {
    throw new Error(response.error || "Failed to capture page context.");
  }
  return response.page;
}

async function performAction(action) {
  const response = await sendRuntimeMessage({
    type: "perform_browser_action",
    action
  });
  if (!response.ok) {
    throw new Error(response.error || `Failed to perform ${action.type}.`);
  }
  return response.result;
}

async function requestAgentStep(payload) {
  const bridgeUrl = await getBridgeUrl();
  const response = await fetch(`${bridgeUrl}/agent/step`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Bridge request failed.");
  }

  return body;
}

async function runAgent(goal) {
  state.running = true;
  state.previousSteps = [];
  elements.sendButton.disabled = true;
  elements.promptInput.disabled = true;

  try {
    let page = await getPageContext();
    let finalStatus = "Run finished.";

    for (let step = 1; step <= MAX_STEPS; step += 1) {
      setStatus(`Planning step ${step}/${MAX_STEPS}...`);
      const result = await requestAgentStep({
        goal,
        conversation: state.conversation,
        page,
        previousSteps: state.previousSteps,
        maxActions: 3
      });

      if (result.assistantMessage) {
        appendMessage("assistant", result.assistantMessage);
        state.conversation.push({ role: "assistant", content: result.assistantMessage });
      }

      if (result.status === "done" || result.status === "need_user_input") {
        finalStatus = result.status === "done" ? "Task complete." : "Waiting for your input.";
        break;
      }

      if (!Array.isArray(result.actions) || result.actions.length === 0) {
        finalStatus = "Agent returned no action. Stopping.";
        break;
      }

      const actionResults = [];
      for (const action of result.actions) {
        setStatus(`Running ${action.type}...`);
        const outcome = await performAction(action);
        actionResults.push(outcome);
        if (action.type === "open_url" || action.type === "go_back" || action.type === "click") {
          await new Promise((resolve) => setTimeout(resolve, 900));
        }
      }

      state.previousSteps.push({
        step,
        actions: result.actions,
        actionResults,
        reasoning: result.reasoning
      });

      page = await getPageContext();
    }

    setStatus(finalStatus);
  } finally {
    state.running = false;
    elements.sendButton.disabled = false;
    elements.promptInput.disabled = false;
    elements.promptInput.focus();
  }
}

async function bootstrap() {
  const bridgeUrl = await getBridgeUrl();
  elements.bridgeUrl.value = bridgeUrl;
  await checkBridgeHealth();
}

elements.sendButton.addEventListener("click", async () => {
  if (state.running) {
    return;
  }

  const content = elements.promptInput.value.trim();
  if (!content) {
    setStatus("Enter a request first.");
    return;
  }

  appendMessage("user", content);
  state.conversation.push({ role: "user", content });
  elements.promptInput.value = "";

  try {
    await runAgent(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    appendMessage("assistant", `Error: ${message}`);
    setStatus("Run failed.");
  }
});

elements.promptInput.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    elements.sendButton.click();
  }
});

elements.saveSettings.addEventListener("click", async () => {
  const bridgeUrl = elements.bridgeUrl.value.trim();
  if (!bridgeUrl) {
    elements.bridgeStatus.textContent = "Provide a bridge URL.";
    return;
  }

  await setBridgeUrl(bridgeUrl);
  elements.bridgeStatus.textContent = `Saved ${bridgeUrl}`;
});

elements.checkBridge.addEventListener("click", () => {
  checkBridgeHealth();
});

elements.settingsToggle.addEventListener("click", () => {
  elements.settingsPanel.classList.toggle("hidden");
});

bootstrap().catch((error) => {
  elements.bridgeStatus.textContent = error instanceof Error ? error.message : "Failed to initialize.";
});
