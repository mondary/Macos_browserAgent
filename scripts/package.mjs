import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");
const extensionSrc = path.join(projectRoot, "chrome-extension");
const extensionDist = path.join(distDir, "chrome-extension");
const extensionZip = path.join(distDir, "chrome-extension.zip");
const fullZip = path.join(distDir, "macos-browser-agent-kit.zip");

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await cp(extensionSrc, extensionDist, { recursive: true });

await execFileAsync("zip", ["-r", extensionZip, "."], {
  cwd: extensionDist
});

await execFileAsync("zip", ["-r", fullZip, "chrome-extension", "bridge", "scripts", "package.json", "README.md"], {
  cwd: projectRoot
});

console.log(`Created ${extensionZip}`);
console.log(`Created ${fullZip}`);
