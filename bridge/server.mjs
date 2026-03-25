import { createServer } from "node:http";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, "agent-schema.json");
const HOST = process.env.BRIDGE_HOST ?? "127.0.0.1";
const PORT = Number(process.env.BRIDGE_PORT ?? "7823");

// CLI Configuration
const AI_CLI = process.env.AI_CLI ?? "codex";
const AI_MODEL = process.env.AI_MODEL ?? "";
const MAX_BODY_SIZE = 8 * 1024 * 1024;

// CLI providers configuration
const CLI_PROVIDERS = {
  codex: {
    bin: process.env.CODEX_BIN ?? "codex",
    buildArgs: (model, outputPath, imagePath) => {
      const args = [
        "exec",
        "--skip-git-repo-check",
        "--sandbox", "read-only",
        "--output-schema", SCHEMA_PATH,
        "--output-last-message", outputPath,
        "-"
      ];
      if (model) {
        args.splice(1, 0, "--model", model);
      }
      if (imagePath) {
        args.splice(args.length - 1, 0, "--image", imagePath);
      }
      return args;
    },
    parseOutput: async (outputPath) => {
      return JSON.parse(await readFile(outputPath, "utf8"));
    }
  },

  gemini: {
    bin: process.env.GEMINI_BIN ?? "gemini",
    buildArgs: (model, outputPath, imagePath) => {
      const args = [];
      if (model) {
        args.push("--model", model);
      }
      if (imagePath) {
        args.push("--image", imagePath);
      }
      args.push("--output", outputPath);
      return args;
    },
    parseOutput: async (outputPath) => {
      const text = await readFile(outputPath, "utf8");
      // Try JSON parse first, fallback to text
      try {
        return JSON.parse(text);
      } catch {
        // If not JSON, wrap in expected format
        return {
          assistantMessage: text,
          status: "done",
          actions: [],
          reasoning: "Direct response from Gemini CLI"
        };
      }
    }
  },

  glm: {
    bin: process.env.GLM_BIN ?? "glm",
    buildArgs: (model, outputPath, imagePath) => {
      const args = [];
      if (model) {
        args.push("-m", model);
      } else {
        args.push("-m", "glm-4.7");
      }
      if (imagePath) {
        args.push("--image", imagePath);
      }
      args.push("--output", outputPath);
      return args;
    },
    parseOutput: async (outputPath) => {
      const text = await readFile(outputPath, "utf8");
      // Try JSON parse first, fallback to text
      try {
        return JSON.parse(text);
      } catch {
        // If not JSON, wrap in expected format
        return {
          assistantMessage: text,
          status: "done",
          actions: [],
          reasoning: "Direct response from GLM CLI"
        };
      }
    }
  }
};

await mkdir(path.join(__dirname, "tmp"), { recursive: true });

function jsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_SIZE) {
        reject(new Error("Request body too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", reject);
  });
}

function buildPrompt(payload) {
  const {
    goal,
    conversation = [],
    page,
    previousSteps = [],
    maxActions = 3
  } = payload;

  return `
You are controlling a Chrome browser through a local extension side panel.
Your job is to decide the next small browser actions needed to satisfy the user's goal.

Rules:
- Use only the supported actions listed below.
- Prefer precise actions that target visible interactive elements by elementId.
- Use at most ${maxActions} actions in a single response.
- After actions run, the system will send you an updated page snapshot.
- If the task is complete, set status to "done" and actions to [].
- If you need credentials, a confirmation, or something unavailable on the page, set status to "need_user_input".
- Never invent page state. Base everything on the provided snapshot.
- The assistantMessage is shown to the user. Keep it concise and useful.
- reasoning should be short and factual.
- For every action object, include every field from the schema. Use null for unused fields.

Supported actions:
- click: { "type": "click", "elementId": number }
- type: { "type": "type", "elementId": number, "text": string }
- scroll: { "type": "scroll", "direction": "up" | "down", "amount": integer }
- keypress: { "type": "keypress", "key": string, "elementId"?: number }
- open_url: { "type": "open_url", "url": string }
- wait: { "type": "wait", "waitMs": integer }
- go_back: { "type": "go_back" }

Conversation so far:
${JSON.stringify(conversation, null, 2)}

User goal:
${goal}

Previous browser steps:
${JSON.stringify(previousSteps, null, 2)}

Current page snapshot:
${JSON.stringify(page, null, 2)}
`.trim();
}

async function runAIStep(payload) {
  const provider = CLI_PROVIDERS[AI_CLI];

  if (!provider) {
    throw new Error(`Unknown AI CLI provider: ${AI_CLI}. Available: ${Object.keys(CLI_PROVIDERS).join(", ")}`);
  }

  const prompt = buildPrompt(payload);
  const requestId = randomUUID();
  const workDir = path.join(tmpdir(), `macos-browser-agent-${requestId}`);
  const outputPath = path.join(workDir, "response.json");

  await mkdir(workDir, { recursive: true });

  let imagePath = null;
  if (payload.page?.screenshotDataUrl?.startsWith("data:image/")) {
    const [, base64] = payload.page.screenshotDataUrl.split(",", 2);
    if (base64) {
      imagePath = path.join(workDir, "page.jpg");
      await writeFile(imagePath, Buffer.from(base64, "base64"));
    }
  }

  const args = provider.buildArgs(AI_MODEL, outputPath, imagePath);

  const child = spawn(provider.bin, args, {
    cwd: payload.cwd || process.cwd(),
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"]
  });

  let stderr = "";
  let stdout = "";

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString("utf8");
  });

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });

  child.stdin.write(prompt);
  child.stdin.end();

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  if (exitCode !== 0) {
    throw new Error(`${AI_CLI} exec failed with code ${exitCode}\n${stderr || stdout}`.trim());
  }

  try {
    const response = await provider.parseOutput(outputPath);
    return response;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

const server = createServer(async (req, res) => {
  try {
    if (!req.url) {
      jsonResponse(res, 400, { error: "Missing URL." });
      return;
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      });
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      jsonResponse(res, 200, {
        ok: true,
        service: "macos-browser-agent-bridge",
        provider: AI_CLI,
        model: AI_MODEL || null
      });
      return;
    }

    if (req.method === "POST" && req.url === "/agent/step") {
      const body = await collectBody(req);
      const payload = JSON.parse(body);
      const result = await runAIStep(payload);
      jsonResponse(res, 200, result);
      return;
    }

    jsonResponse(res, 404, { error: "Not found." });
  } catch (error) {
    jsonResponse(res, 500, {
      error: error instanceof Error ? error.message : "Unknown error."
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Bridge listening on http://${HOST}:${PORT}`);
  console.log(`Using AI CLI: ${AI_CLI}${AI_MODEL ? ` (model: ${AI_MODEL})` : ""}`);
});
