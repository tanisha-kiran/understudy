import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { state, reset, toggleInterfaceChange, saveReport, undo } from "./state.mjs";
import { compile, SkillCardSchema, demoDomain } from "./compiler.mjs";
import * as runner from "./runner.mjs";
import { recorder, resolveScreenshot } from "./recorder.mjs";
import { store } from "./store.mjs";
import { createReadStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { ticketAdapter } from "./ticket-adapter.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// --- Sandbox pages (the apps the runner automates) ---
app.use("/sandbox", express.static(path.join(__dirname, "sandbox"), { extensions: ["html"] }));

// --- State / demo controls ---
app.get("/api/state", (_req, res) => res.json(state));
app.post("/api/reset", (_req, res) => {
  try { runner.resetRunState(); res.json(reset()); }
  catch (e) { res.status(409).json({ error: String(e?.message ?? e) }); }
});
app.post("/api/interface-change", (_req, res) => res.json({ submitLabel: toggleInterfaceChange() }));

// --- Report form submission (called by the DailyReport page) ---
app.post("/api/report", (req, res) => res.json(saveReport(req.body ?? {})));

// --- Undo (restores the snapshot taken before the last run) ---
app.post("/api/undo", (_req, res) => {
  const restored = undo();
  if (!restored) return res.status(409).json({ error: "Nothing to undo." });
  res.json(restored);
});

// --- Compiler ---
app.post("/api/compile", async (req, res) => {
  try {
    const result = await compile(req.body);
    store.saveSkill(result.card, false);
    store.audit("skill.compiled", { skillId: result.card.id, source: result.source });
    res.json({ ...result, approved: false });
  } catch (e) {
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

app.get("/api/skills", (_req, res) => res.json({ skills: store.listSkills() }));
app.post("/api/skills", (req, res) => {
  try {
    const card = SkillCardSchema.parse(req.body?.card ?? req.body);
    if (!card.allowedDomains.length || !card.allowedDomains.every((domain) => domain === demoDomain)) throw new Error("A Skill Card may only allow the current local demo domain.");
    const saved = store.saveSkill(card, false);
    store.audit("skill.edited", { skillId: card.id });
    res.json(saved);
  } catch (e) { res.status(400).json({ error: String(e?.message ?? e) }); }
});
app.post("/api/skills/:id/approve", (req, res) => {
  const skill = store.getSkill(req.params.id);
  if (!skill) return res.status(404).json({ error: "Skill card not found." });
  if (!skill.card.requiresApproval || !skill.card.allowedDomains?.every((domain) => domain === demoDomain)) return res.status(400).json({ error: "This skill does not meet the local approval and domain-scope policy." });
  store.approveSkill(req.params.id);
  store.audit("skill.approved", { skillId: req.params.id });
  res.json(store.getSkill(req.params.id));
});

app.get("/api/audit", (_req, res) => res.json({ entries: store.listAudit(200), storage: { type: store.kind, durable: true } }));

app.get("/api/recording", (_req, res) => res.json(recorder.status));
app.post("/api/recording/start", async (req, res) => {
  try {
    if (["running", "awaiting_approval", "paused"].includes(runner.runStatus)) throw new Error("Stop the current run before starting a recording.");
    res.json(await recorder.start(req.body ?? {}));
  } catch (e) { res.status(409).json({ error: String(e?.message ?? e) }); }
});
app.post("/api/recording/narration", async (req, res) => {
  try { res.json(await recorder.narrate(req.body?.text, req.body?.at)); }
  catch (e) { res.status(409).json({ error: String(e?.message ?? e) }); }
});
app.post("/api/recording/stop", async (_req, res) => {
  try { res.json(await recorder.stop()); }
  catch (e) { res.status(500).json({ error: String(e?.message ?? e) }); }
});
app.get("/api/record/screenshot/:filename", (req, res) => {
  const file = resolveScreenshot(req.params.filename);
  if (!file) return res.status(404).end();
  res.type("png").sendFile(file, (error) => { if (error && !res.headersSent) res.status(404).end(); });
});

// --- Runner (stubbed: returns 501 until Codex implements server/runner.mjs) ---
const guard = (fn) => async (req, res) => {
  try {
    res.json((await fn(req.body)) ?? { ok: true });
  } catch (e) {
    res.status(501).json({ error: String(e?.message ?? e) });
  }
};
const beginApprovedRun = (skillId, triggerSource) => {
  const skill = store.getSkill(skillId);
  if (!skill) throw new Error("Save the Skill Card before running it.");
  if (!skill.approved) throw new Error("Approve this Skill Card before it can run.");
  if (!skill.card.allowedDomains?.length || !skill.card.allowedDomains.every((domain) => domain === demoDomain)) throw new Error("This run is outside the skill's allowed demo domain.");
  if (["running", "awaiting_approval", "paused"].includes(runner.runStatus)) throw new Error("A run is already in progress.");
  void runner.startRun({ card: skill.card, triggerSource }).catch((e) => console.error("Runner startup failed:", e));
  return { status: "running", skillId };
};
app.post("/api/run", (req, res) => {
  if (["running", "awaiting_approval", "paused"].includes(runner.runStatus)) return res.status(409).json({ error: "A run is already in progress." });
  try { res.json(beginApprovedRun(req.body?.skillId, req.body?.triggerSource || "manual")); }
  catch (e) { res.status(403).json({ error: String(e?.message ?? e) }); }
});
app.post("/api/run/approve", guard(runner.approveRun));
app.post("/api/run/stop", guard(runner.stopRun));
app.post("/api/run/pause", guard(runner.pauseRun));
app.post("/api/run/resume", guard(runner.resumeRun));
app.get("/api/run/timeline", (_req, res) => res.json({ status: runner.runStatus, timeline: runner.timeline, history: runner.history() }));
app.get("/api/run/events", (req, res) => {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  send({ status: runner.runStatus, timeline: runner.timeline });
  const unsubscribe = runner.subscribeTimeline(send);
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 20_000);
  req.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
});

app.post("/api/triggers/simulate", (req, res) => {
  try { res.json(beginApprovedRun(req.body?.skillId, "simulated local event")); }
  catch (e) { res.status(403).json({ error: String(e?.message ?? e) }); }
});
app.post("/api/webhook", (req, res) => {
  const ip = String(req.ip || req.socket.remoteAddress || "").replace(/^::ffff:/, "");
  const local = ip === "127.0.0.1" || ip === "::1";
  const secret = process.env.UNDERSTUDY_WEBHOOK_SECRET;
  if ((secret && req.get("x-understudy-secret") !== secret) || (!secret && !local)) return res.status(401).json({ error: "Webhook authentication failed. Configure UNDERSTUDY_WEBHOOK_SECRET for non-local delivery." });
  try {
    const result = beginApprovedRun(req.body?.skillId, "local webhook event");
    store.audit("trigger.webhook_received", { skillId: req.body?.skillId, event: req.body?.event || "unspecified" });
    res.json(result);
  } catch (e) { res.status(403).json({ error: String(e?.message ?? e) }); }
});

// --- Live helpdesk data adapter (ingest and display only; no ticket is changed) ---
const webhookAllowed = (req) => {
  const ip = String(req.socket.remoteAddress || "").replace(/^::ffff:/, "");
  const localSocket = ip === "127.0.0.1" || ip === "::1";
  // A reverse proxy can make a public request appear loopback-local. Do not
  // accept forwarded traffic without the shared secret when one is unset.
  const forwarded = Boolean(req.get("forwarded") || req.get("x-forwarded-for") || req.get("x-real-ip"));
  const local = localSocket && !forwarded;
  const secret = process.env.UNDERSTUDY_WEBHOOK_SECRET;
  return secret ? req.get("x-understudy-secret") === secret : local;
};
app.get("/api/integrations/tickets", (_req, res) => res.json({
  adapter: ticketAdapter.kind,
  delivery: "webhook",
  actionPolicy: "events are stored and shown for review; no helpdesk write is performed",
  authentication: process.env.UNDERSTUDY_WEBHOOK_SECRET ? "shared-secret" : "loopback-only",
  events: ticketAdapter.list(),
}));
app.post("/api/integrations/tickets/webhook", (req, res) => {
  if (!webhookAllowed(req)) return res.status(401).json({ error: "Ticket webhook authentication failed. Configure UNDERSTUDY_WEBHOOK_SECRET and send x-understudy-secret for non-local delivery." });
  try {
    const source = String(req.get("x-understudy-source") || "generic-helpdesk-webhook").slice(0, 80);
    const result = ticketAdapter.ingest(req.body, source);
    res.status(result.deduplicated ? 200 : 202).json(result);
  } catch (e) { res.status(400).json({ error: String(e?.message ?? e) }); }
});
app.post("/api/integrations/tickets/sample", (_req, res) => {
  try {
    const result = ticketAdapter.ingest({
      event_id: `sample-${randomUUID()}`,
      occurred_at: new Date().toISOString(),
      ticket: { id: `T-${String(Date.now()).slice(-6)}`, subject: "Customer cannot export the monthly report", priority: "high", status: "open" },
    }, "sample-event");
    res.status(202).json(result);
  } catch (e) { res.status(400).json({ error: String(e?.message ?? e) }); }
});
app.get("/api/integrations/tickets/events", (req, res) => {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  const send = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
  send({ type: "snapshot", events: ticketAdapter.list() });
  const unsubscribe = ticketAdapter.subscribe((ticket) => send({ type: "ticket.received", ticket, events: ticketAdapter.list() }));
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 20_000);
  req.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => console.log(`Understudy server on http://localhost:${port}`));
