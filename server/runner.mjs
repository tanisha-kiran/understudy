import { chromium } from "playwright";
import { state, takeSnapshot, appendRun, setRunPreview } from "./state.mjs";
import { EventEmitter } from "node:events";
import { store } from "./store.mjs";

export const timeline = [];
const timelineEvents = new EventEmitter();
timelineEvents.setMaxListeners(100);
export let runStatus = "idle";
let browser;
let page;
let approval;
let stopped = false;
let paused = false;
let current = null;

const push = (step, status = "done", detail = "") => {
  const entry = { t: new Date().toISOString(), step, status, detail };
  timeline.push(entry);
  store.audit("run.timeline", { step, status, detail });
  timelineEvents.emit("update", { status: runStatus, timeline: [...timeline] });
};
export const subscribeTimeline = (listener) => { timelineEvents.on("update", listener); return () => timelineEvents.off("update", listener); };
const waitApproval = () => new Promise((resolve) => { approval = resolve; });
const settle = (value) => { const done = approval; approval = null; done?.(value); };
const checkStop = () => { if (stopped) throw new Error("Run stopped by user."); };

export async function startRun(runInput = {}) {
  if (["running", "awaiting_approval", "paused"].includes(runStatus)) throw new Error("A run is already in progress.");
  const skillCard = runInput.card || runInput;
  if (!Array.isArray(skillCard?.allowedDomains) || !skillCard.allowedDomains.every((domain) => domain === "localhost:8787")) throw new Error("This demo runner only accepts cards limited to localhost:8787.");
  timeline.splice(0, timeline.length);
  stopped = false;
  paused = false;
  runStatus = "running";
  current = { id: `run-${Date.now()}`, skillId: skillCard.id, title: skillCard?.title || "Generate Daily Attendance Report", startedAt: new Date().toISOString(), recovery: false, repairs: [], triggerSource: runInput.triggerSource || "manual", dryRunReview: !state.runs.some((run) => run.skillId === skillCard.id), expected: null };
  push("Starting sandbox browser", "running", "Playwright controls the local demo pages; scope is fixed to the two allowed sandbox apps.");

  const base = `http://localhost:${process.env.PORT ?? 8787}`;
  const headless = process.env.HEADLESS === "true" || process.env.CI === "true";
  try {
    try {
      // Prefer the installed stable Chrome for a quick local demo; fall back to
      // Playwright's pinned Chromium if Chrome is not present on this machine.
      browser = await chromium.launch({ headless, channel: "chrome" });
    } catch {
      browser = await chromium.launch({ headless });
    }
    page = await browser.newPage();
    await page.setViewportSize({ width: 1120, height: 720 });
    await page.goto(`${base}/sandbox/attendance`, { waitUntil: "networkidle" });
    const students = await page.locator("#attendance-table tbody tr").evaluateAll((rows) => rows.map((row) => ({
      name: row.cells[0]?.textContent?.trim() || "",
      status: row.cells[1]?.textContent?.trim() || "",
    })));
    if (!students.length) throw new Error("AttendanceTracker returned no student rows.");
    const count = students.filter((student) => student.status === "Present").length;
    const note = `Attendance recorded for today: ${count} of ${students.length} students present.`;
    current.expected = { count, note, total: students.length };
    push("Read AttendanceTracker", "done", `Read ${students.length} student records from the page. ${count} marked Present.`);
    push("Calculate present count", "done", `${count} present out of ${students.length}.`);

    takeSnapshot();
    await page.goto(`${base}/sandbox/report`, { waitUntil: "networkidle" });
    await page.locator("#count").fill(String(count));
    setRunPreview({ active: true, count, note, target: "#count" });
    await page.locator("#note").fill(note);
    setRunPreview({ active: true, count, note, target: "#note" });
    push("Fill DailyReport", "done", "Count and note entered through the report form.");
    runStatus = "awaiting_approval";
    push(current.dryRunReview ? "First-run dry preview ready" : "Waiting for your approval", "waiting", `Ready to submit: ${count} students present. Review the prepared report; nothing is submitted until you approve.`);
    const approved = await waitApproval();
    checkStop();
    if (!approved) throw new Error("Run stopped before submission.");

    // Re-read the page after the approval gate. This makes the interface-change control
    // a genuine locator failure/recovery scenario instead of a pre-known replacement.
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#count").fill(String(count));
    await page.locator("#note").fill(note);
    setRunPreview({ active: true, count, note, target: "#submit-btn" });
    const original = page.getByRole("button", { name: "Submit", exact: true });
    if (await original.count() === 1) {
      await original.click();
      push("Click Submit", "done", "Original accessible button locator matched.");
    } else {
      push("Original target ‘Submit’ not found", "recovery", "Inspected the report page's visible buttons after the recorded locator failed.");
      const buttons = await page.getByRole("button").allTextContents();
      const replacement = buttons.map((label) => label.trim()).find((label) => label === "Send Report");
      if (!replacement) throw new Error("Could not identify a safe replacement button. No report was submitted.");
      await page.getByRole("button", { name: replacement, exact: true }).click();
      current.recovery = true;
      current.repairs.push({ from: "Submit", to: "Send Report", reason: "Original accessible-name target was absent; the only visible button matched the known report-submit label." });
      push("Recovered target: Send Report", "recovery", "A single visible button matched the known report-submit label after Submit was absent.");
    }
    const saved = await page.locator("#saved").textContent();
    const confirmation = await page.getByRole("status").isVisible();
    const apiReport = await page.evaluate(async () => (await fetch("/api/state")).json());
    const actual = apiReport.report;
    const verified = confirmation && actual.status === "Submitted" && actual.count === count && actual.note === note && saved?.includes(`count=${count}`);
    push("Verify saved report", verified ? "done" : "error", `Expected ${count}; saved ${actual.count ?? "empty"}. Confirmation ${confirmation ? "visible" : "missing"}.`);
    current.verification = verified;
    current.actual = actual;
    current.finishedAt = new Date().toISOString();
    current.status = verified ? "Verified" : "Verification failed";
    current.durationMs = Date.now() - Date.parse(current.startedAt);
    appendRun({ ...current });
    store.audit("run.completed", { runId: current.id, skillId: current.skillId, triggerSource: current.triggerSource, status: current.status, verified, recovery: current.recovery, durationMs: current.durationMs });
    runStatus = verified ? "done" : "failed";
    setRunPreview({ active: false, target: "" });
    if (!verified) throw new Error("The saved report did not match the intended values.");
  } catch (error) {
    runStatus = stopped ? "stopped" : "failed";
    push(runStatus === "stopped" ? "Run stopped" : "Run failed", "error", error?.message ?? String(error));
    if (current) { current.status = runStatus; current.finishedAt = new Date().toISOString(); current.durationMs = Date.now() - Date.parse(current.startedAt); appendRun({ ...current }); }
    setRunPreview({ active: false, target: "" });
  } finally {
    try { await browser?.close(); } catch {}
    browser = undefined; page = undefined; approval = null;
    timelineEvents.emit("update", { status: runStatus, timeline: [...timeline] });
  }
  return { status: runStatus, timeline };
}

export async function approveRun() {
  if (runStatus !== "awaiting_approval") throw new Error("Resume the paused run before approving submission.");
  runStatus = "running";
  push("Approval received", "done", "User approved report submission.");
  settle(true);
  return { status: runStatus };
}

export async function pauseRun() {
  if (runStatus !== "awaiting_approval") throw new Error("Pause is available while the run is waiting for approval.");
  paused = true;
  runStatus = "paused";
  push("Paused", "waiting", "The report has not been submitted.");
  return { status: runStatus };
}

export async function resumeRun() {
  if (runStatus !== "paused") throw new Error("There is no paused run to resume.");
  paused = false;
  runStatus = "awaiting_approval";
  push("Run resumed", "waiting", "Review and explicitly approve the pending report submission.");
  return { status: runStatus };
}

export async function stopRun() {
  if (!["running", "awaiting_approval", "paused"].includes(runStatus)) return { status: runStatus };
  stopped = true;
  settle(false);
  try { await browser?.close(); } catch {}
  runStatus = "stopped";
  push("Run stopped", "error", "The browser run was cancelled.");
  return { status: runStatus };
}

export const history = () => state.runs;

export function resetRunState() {
  if (["running", "awaiting_approval", "paused"].includes(runStatus)) throw new Error("Stop the active run before resetting the demo.");
  timeline.splice(0, timeline.length);
  runStatus = "idle";
  current = null;
  paused = false;
  return { status: runStatus, timeline };
}
