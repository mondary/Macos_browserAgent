const MAX_STEPS = 8;
const state = {
  conversation: [],
  running: false,
  previousSteps: [],
  theme: "sober",
  tamaFrame: 0,
  tamaInterval: null
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
  themeToggle: document.querySelector("#theme-toggle"),
  themeIcon: document.querySelector("#theme-icon"),
  tamagotchiContainer: document.querySelector("#tamagotchi-container"),
  tamagotchiEl: document.querySelector("#tamagotchi"),
  tamagotchiStatus: document.querySelector("#tamagotchi-status"),
  template: document.querySelector("#message-template")
};

// ===== TAMAGOTCHI =====

const TAMA_FRAMES = {
  idle: [
    `   ╔══════╗
   ║      ║
   ║  ●  ● ║
   ║  ╰──╯ ║
   ║  ───  ║
   ║ ╱    ╲║
   ╚══════╝`,
    `   ╔══════╗
   ║      ║
   ║  ◉  ◉ ║
   ║  ╰──╯ ║
   ║  ───  ║
   ║ ╱    ╲║
   ╚══════╝`
  ],
  thinking: [
    `   ╔══════╗
   ║      ║
   ║  ◉  ◉ ║
   ║  o  o ║
   ║  ───  ║
   ║ ╱ ══ ╲║
   ╚══════╝`,
    `   ╔══════╗
   ║      ║
   ║  ◉  ◉ ║
   ║  O  o ║
   ║  ───  ║
   ║ ╱ ══ ╲║
   ╚══════╝`,
    `   ╔══════╗
   ║      ║
   ║  ◉  ◉ ║
   ║  o  O ║
   ║  ───  ║
   ║ ╱ ══ ╲║
   ╚══════╝`,
    `   ╔══════╗
   ║      ║
   ║  ◉  ◉ ║
   ║  O  O ║
   ║  ───  ║
   ║ ╱ ══ ╲║
   ╚══════╝`
  ],
  working: [
    `   ╔══════╗
   ║      ║
   ║  ▴  ▴ ║
   ║  ╰──╯ ║
   ║  ───  ║
   ║ >    <║
   ╚══════╝`,
    `   ╔══════╗
   ║      ║
   ║  ▴  ▴ ║
   ║  ╰──╯ ║
   ║  ───  ║
   ║ <    >║
   ╚══════╝`,
    `   ╔══════╗
   ║      ║
   ║  ▴  ▴ ║
   ║  ╰──╯ ║
   ║  ───  ║
   ║ >    <║
   ╚══════╝`
  ],
  done: [
    `   ╔══════╗
   ║      ║
   ║  ▸  ◂ ║
   ║  ╰ω╯  ║
   ║  ───  ║
   ║ ╲    ╱║
   ╚══════╝`
  ],
  error: [
    `   ╔══════╗
   ║      ║
   ║  ╳  ╳ ║
   ║  ╰──╯ ║
   ║  ───  ║
   ║ ╱ ══ ╲║
   ╚══════╝`
  ]
};

let tamaMood = "idle";

function setTamaMood(mood) {
  tamaMood = mood;
  const statusTexts = {
    idle: "waiting...",
    thinking: "thinking...",
    working: "executing...",
    done: "done!",
    error: "error!"
  };
  elements.tamagotchiStatus.textContent = statusTexts[mood] || "";
}

function animateTamagotchi() {
  const frames = TAMA_FRAMES[tamaMood] || TAMA_FRAMES.idle;
  elements.tamagotchiEl.textContent = frames[state.tamaFrame % frames.length];
  state.tamaFrame++;
}

function startTamagotchi() {
  if (state.tamaInterval) return;
  const speed = tamaMood === "idle" || tamaMood === "done" || tamaMood === "error" ? 1200 : 350;
  state.tamaInterval = setInterval(() => {
    animateTamagotchi();
    // adjust speed if mood changed
    const newSpeed = tamaMood === "idle" || tamaMood === "done" || tamaMood === "error" ? 1200 : 350;
    if (newSpeed !== speed) {
      clearInterval(state.tamaInterval);
      state.tamaInterval = null;
      startTamagotchi();
    }
  }, speed);
}

function stopTamagotchi() {
  if (state.tamaInterval) {
    clearInterval(state.tamaInterval);
    state.tamaInterval = null;
  }
}

// ===== THEME =====

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  elements.themeIcon.textContent = theme === "graffiti" ? "grf" : "sbr";
  elements.tamagotchiContainer.classList.toggle("hidden", theme !== "graffiti");
  if (theme === "graffiti") {
    startTamagotchi();
    animateTamagotchi();
  } else {
    stopTamagotchi();
  }
}

elements.themeToggle.addEventListener("click", () => {
  applyTheme(state.theme === "sober" ? "graffiti" : "sober");
});

// ===== CHAT =====

function setStatus(text) {
  elements.runStatus.textContent = text;
  if (state.theme === "graffiti") {
    if (text.includes("Planning") || text.includes("Planning")) {
      setTamaMood("thinking");
    } else if (text.includes("Running") || text.includes("Running")) {
      setTamaMood("working");
    } else if (text.includes("complete") || text.includes("Task complete")) {
      setTamaMood("done");
    } else if (text.includes("failed") || text.includes("Failed") || text.includes("Error")) {
      setTamaMood("error");
    } else {
      setTamaMood("idle");
    }
  }
}

function escapeHtml(text) {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}

function formatMessage(content) {
  const escaped = escapeHtml(content);
  const lines = escaped.split("\n");
  const formatted = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // empty line → break
    if (trimmed === "") {
      formatted.push("<br>");
      continue;
    }

    // bullet: - item, * item
    if (/^[-*]\s/.test(trimmed)) {
      formatted.push(`<span class="bullet"><span class="bullet-dot"></span>${trimmed.replace(/^[-*]\s/, "")}</span>`);
      continue;
    }

    // numbered: 1. item
    if (/^\d+\.\s/.test(trimmed)) {
      formatted.push(`<span class="bullet"><span class="bullet-dot">${trimmed.match(/^\d+/)[0]}</span>${trimmed.replace(/^\d+\.\s/, "")}</span>`);
      continue;
    }

    // **bold** → bold
    const bolded = trimmed.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // `code` → code
    const coded = bolded.replace(/`(.+?)`/g, "<code>$1</code>");

    formatted.push(coded);
  }

  return formatted.join("\n");
}

function appendMessage(role, content) {
  const fragment = elements.template.content.cloneNode(true);
  const root = fragment.querySelector(".message");
  root.dataset.role = role;
  fragment.querySelector(".msg-role").textContent = role === "user" ? "you" : "agent";
  fragment.querySelector(".msg-body").innerHTML = formatMessage(content);
  elements.chatLog.appendChild(fragment);
  elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
}

// ===== BRIDGE COMMS =====

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
    return true;
  } catch (error) {
    elements.bridgeStatus.textContent = error instanceof Error ? error.message : "Bridge check failed.";
    return false;
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
  let response;
  try {
    response = await fetch(`${bridgeUrl}/agent/step`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (fetchError) {
    throw new Error(`Cannot reach bridge at ${bridgeUrl}.\n${fetchError.message}\n\nRun in terminal: npm start`);
  }

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || `Bridge error ${response.status}`);
  }

  return body;
}

// ===== AGENT LOOP =====

async function runAgent(goal) {
  state.running = true;
  state.previousSteps = [];
  elements.sendButton.disabled = true;
  elements.promptInput.disabled = true;
  if (state.theme === "graffiti") setTamaMood("thinking");

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
    if (state.theme === "graffiti") {
      setTamaMood(finalStatus.includes("complete") ? "done" : "idle");
    }
  } catch (error) {
    if (state.theme === "graffiti") setTamaMood("error");
    throw error;
  } finally {
    state.running = false;
    elements.sendButton.disabled = false;
    elements.promptInput.disabled = false;
    elements.promptInput.focus();
  }
}

// ===== EVENT LISTENERS =====

const SETUP_GUIDE = `bridge is not running.

quick setup:
1. open a terminal
2. cd ~/Documents/GitHub/PROJECTS/Macos_browserAgent
3. npm start           (codex, default)
   npm run start:gemini  (gemini cli)
   npm run start:glm     (glm cli)
4. wait for "Bridge listening on http://127.0.0.1:7823"
5. navigate to a normal webpage (not chrome://)
6. type your request below and hit send

ctrl/cmd+enter to send`;

async function bootstrap() {
  const bridgeUrl = await getBridgeUrl();
  elements.bridgeUrl.value = bridgeUrl;

  const isUp = await checkBridgeHealth();
  if (!isUp) {
    appendMessage("agent", SETUP_GUIDE);
  }
}

elements.sendButton.addEventListener("click", async () => {
  if (state.running) return;

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

// ===== INIT =====

bootstrap().catch((error) => {
  elements.bridgeStatus.textContent = error instanceof Error ? error.message : "Failed to initialize.";
});
