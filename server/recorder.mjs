import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { store } from "./store.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const recordingsDir = path.join(root, "data", "recordings");
const allowedPaths = new Set(["/sandbox/attendance", "/sandbox/report"]);
let browser;
let page;
let active = null;

const recordStep = async (event) => {
  if (!active || !page) return;
  const normalized = { ...event, at: new Date().toISOString(), url: event.url || page.url() };
  const index = active.steps.length + 1;
  let screenshot = null;
  try {
    const bytes = await page.screenshot({ type: "png", animations: "disabled" });
    const filename = `${active.id}-step-${String(index).padStart(3, "0")}.png`;
    await mkdir(recordingsDir, { recursive: true });
    await writeFile(path.join(recordingsDir, filename), bytes);
    screenshot = `/api/record/screenshot/${filename}`;
  } catch { /* A page can navigate while its event screenshot is being captured. */ }
  active.steps.push({ ...normalized, screenshot });
  store.saveRecording(active);
  store.audit("recording.step", { recordingId: active.id, index, type: normalized.type, target: normalized.selector || normalized.target });
};

export const recorder = {
  get status() { return active ? { status: "recording", ...active } : { status: "idle", steps: [] }; },
  async start({ startPath = "/sandbox/attendance" } = {}) {
    if (!allowedPaths.has(startPath)) throw new Error("Recorder can only open the two local demo apps.");
    if (active) throw new Error("A recording is already active.");
    const headless = process.env.HEADLESS === "true" || process.env.CI === "true";
    try { browser = await chromium.launch({ headless, channel: "chrome" }); }
    catch { browser = await chromium.launch({ headless }); }
    active = { id: `recording-${Date.now()}`, status: "recording", createdAt: new Date().toISOString(), steps: [], narration: [], allowedOrigin: `http://localhost:${process.env.PORT ?? 8787}` };
    page = await browser.newPage();
    await page.route("**/*", (route) => {
      try { if (new URL(route.request().url()).origin === active?.allowedOrigin) return route.continue(); } catch {}
      return route.abort("blockedbyclient");
    });
    page.on("popup", (popup) => void popup.close());
    await page.exposeFunction("__understudyCapture", recordStep);
    await page.addInitScript((origin) => {
      if (location.origin !== origin) return;
      const cssSelector = (el) => {
        if (!el || el.nodeType !== 1) return "";
        if (el.id) return `#${CSS.escape(el.id)}`;
        const test = el.getAttribute("data-testid");
        if (test) return `[data-testid="${test}"]`;
        const aria = el.getAttribute("aria-label");
        if (aria) return `${el.tagName.toLowerCase()}[aria-label="${aria}"]`;
        return el.tagName.toLowerCase();
      };
      const emit = (event) => {
        const el = event.target?.closest?.("input,textarea,select,button,a,[role=button]") || event.target;
        if (!el || !window.__understudyCapture) return;
        const text = (el.innerText || el.textContent || el.getAttribute?.("aria-label") || "").trim().slice(0, 180);
        window.__understudyCapture({ type: event.type, selector: cssSelector(el), target: el.getAttribute?.("aria-label") || text || el.tagName.toLowerCase(), visibleText: text, value: "value" in el ? String(el.value).slice(0, 500) : undefined, tag: el.tagName.toLowerCase(), url: location.href });
      };
      let inputTimer;
      document.addEventListener("click", emit, true);
      document.addEventListener("change", emit, true);
      document.addEventListener("input", (e) => { clearTimeout(inputTimer); inputTimer = setTimeout(() => emit(e), 350); }, true);
      window.addEventListener("pageshow", () => setTimeout(() => window.__understudyCapture?.({ type: "navigate", selector: "", target: document.title, visibleText: document.querySelector("h1")?.textContent?.trim() || document.title, url: location.href }), 100));
    }, active.allowedOrigin);
    try { await page.goto(`${active.allowedOrigin}${startPath}`, { waitUntil: "domcontentloaded" }); }
    catch (error) { await browser.close(); browser = undefined; page = undefined; active = null; throw error; }
    store.saveRecording(active);
    store.audit("recording.started", { recordingId: active.id, startPath });
    return this.status;
  },
  async narrate(text, at = new Date().toISOString()) {
    if (!active) throw new Error("Start Teach mode before adding narration.");
    const transcript = String(text ?? "").trim().slice(0, 1000);
    if (!transcript) return this.status;
    active.narration.push({ at, text: transcript });
    store.saveRecording(active);
    store.audit("recording.narration", { recordingId: active.id, at, text: transcript });
    return this.status;
  },
  async stop() {
    if (!active) return this.status;
    active.status = "complete";
    active.finishedAt = new Date().toISOString();
    store.saveRecording(active);
    store.audit("recording.stopped", { recordingId: active.id, steps: active.steps.length });
    try { await browser?.close(); } finally { browser = undefined; page = undefined; }
    const done = active;
    active = null;
    return { status: "complete", ...done };
  },
};

export const resolveScreenshot = (filename) => {
  if (!/^recording-[\w-]+-step-\d+\.png$/.test(filename)) return null;
  return path.join(recordingsDir, filename);
};

