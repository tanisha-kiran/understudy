import { spawn } from "node:child_process";
import { createServer } from "node:net";

let serverPort = Number(process.env.PORT || 8787);
let webPort = Number(process.env.VITE_PORT || 5173);
let base = `http://localhost:${serverPort}`;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let child;

const isAvailable = async () => {
  try { return (await fetch(`${base}/api/state`)).ok; } catch { return false; }
};

const availablePort = async (preferred) => {
  for (let port = preferred; port < preferred + 40; port += 1) {
    const available = await new Promise((resolve) => {
      const probe = createServer();
      probe.once("error", () => resolve(false));
      probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true)));
    });
    if (available) return port;
  }
  throw new Error(`No free port found near ${preferred}.`);
};

if (!(await isAvailable())) {
  serverPort = await availablePort(serverPort);
  webPort = await availablePort(webPort);
  base = `http://localhost:${serverPort}`;
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  child = spawn(command, ["run", "dev"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, PORT: String(serverPort), VITE_PORT: String(webPort), UNDERSTUDY_SERVER_URL: base },
  });
  child.on("exit", (code) => { if (code && code !== 0) process.exitCode = code; });
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await isAvailable()) { ready = true; break; }
    if (child.exitCode !== null) break;
    await delay(500);
  }
  if (!ready) { child.kill(); throw new Error("The Understudy server did not become ready within 40 seconds."); }
}

const reset = await fetch(`${base}/api/reset`, { method: "POST" });
if (!reset.ok) throw new Error(`Could not reset the demo: ${await reset.text()}`);
console.log(`Demo data reset. Open http://localhost:${webPort} and choose Teach a new skill.`);
console.log("Stop this command with Ctrl+C when the rehearsal is complete.");

if (child) {
  const stop = () => { child?.kill(); process.exit(); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  await new Promise((resolve) => child.once("exit", resolve));
} else {
  console.log("Existing dev server detected; it was reset and remains running.");
}

