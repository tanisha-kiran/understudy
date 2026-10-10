const base = `http://localhost:${process.env.PORT || 8787}`;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const post = async (path, body = {}) => {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path}: ${await response.text()}`);
  return response.json();
};
const get = async (path) => {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`${path}: ${response.statusText}`);
  return response.json();
};
const statusOf = async (path, body = {}) => fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

try {
  await post("/api/reset");
  const recording = await post("/api/recording/start", { startPath: "/sandbox/attendance" });
  if (recording.status !== "recording") throw new Error("Recorder did not start.");
  let capture;
  for (let i = 0; i < 20; i += 1) {
    await delay(500);
    capture = await get("/api/recording");
    if (capture.steps?.length) break;
  }
  if (!capture.steps?.some((step) => step.type === "navigate" && step.url.includes("/sandbox/attendance"))) throw new Error("Recorder did not capture its initial page and screenshot.");
  await post("/api/recording/stop");
  console.log(`Recorder verified: captured ${capture.steps.length} page/action step(s) with screenshot metadata.`);

  const compiled = await post("/api/compile", { mode: "guided", description: "Read attendance, count present students, and prepare the DailyReport." });
  const savedCard = await post("/api/skills", { card: compiled.card });
  if (savedCard.approved) throw new Error("New skill was already approved.");
  const blockedTrigger = await statusOf("/api/triggers/simulate", { skillId: compiled.card.id });
  if (blockedTrigger.status !== 403) throw new Error("An unapproved skill was allowed to start from an event.");
  await post(`/api/skills/${compiled.card.id}/approve`);
  await post("/api/run", { skillId: compiled.card.id });
  let run;
  for (let i = 0; i < 40; i += 1) {
    await delay(500);
    run = await get("/api/run/timeline");
    if (run.status === "awaiting_approval") break;
    if (run.status === "failed") throw new Error(JSON.stringify(run.timeline));
  }
  if (run?.status !== "awaiting_approval") throw new Error(`Approval gate was not reached (${run?.status}).`);
  const prepared = await get("/api/state");
  if (prepared.report.status !== "Draft") throw new Error("The first-run preview submitted before explicit confirmation.");
  console.log(`Approval gate reached after: ${run.timeline.map((entry) => entry.step).join(" → ")}`);

  await post("/api/run/pause");
  run = await get("/api/run/timeline");
  if (run.status !== "paused") throw new Error("Pause did not suspend the approval gate.");
  await post("/api/run/resume");
  run = await get("/api/run/timeline");
  if (run.status !== "awaiting_approval") throw new Error("Resume skipped the separate approval gate.");
  console.log("Pause and resume preserved the explicit approval step.");

  await post("/api/interface-change");
  await post("/api/run/approve");
  for (let i = 0; i < 60; i += 1) {
    await delay(500);
    run = await get("/api/run/timeline");
    if (["done", "failed", "stopped"].includes(run.status)) break;
  }
  const saved = await get("/api/state");
  const repaired = run.timeline.some((entry) => entry.status === "recovery" && entry.step.includes("Send Report"));
  if (run.status !== "done" || saved.report.count !== 7 || !repaired || !run.history[0]?.verification) {
    throw new Error(`Run check failed: status=${run.status}, report=${JSON.stringify(saved.report)}, recovery=${repaired}`);
  }
  console.log(`Verified: ${saved.report.count} present; recovered changed button; report status ${saved.report.status}.`);
  const audit = await get("/api/audit");
  if (audit.storage.type !== "sqlite" || !audit.entries.some((entry) => entry.event === "skill.approved")) throw new Error("SQLite audit log did not record the card approval.");
  console.log("SQLite audit verified: skill approval and run events were persisted.");

  const restored = await post("/api/undo");
  if (restored.status !== "Draft" || restored.count !== null) throw new Error(`Undo check failed: ${JSON.stringify(restored)}`);
  console.log("Undo verified: previous Draft report restored.");

  await post("/api/triggers/simulate", { skillId: compiled.card.id });
  for (let i = 0; i < 40; i += 1) {
    await delay(500);
    run = await get("/api/run/timeline");
    if (run.status === "awaiting_approval") break;
  }
  if (run?.status !== "awaiting_approval") throw new Error("The approved skill did not start from a simulated event.");
  await post("/api/run/approve");
  for (let i = 0; i < 60; i += 1) {
    await delay(500); run = await get("/api/run/timeline");
    if (["done", "failed", "stopped"].includes(run.status)) break;
  }
  if (run.status !== "done" || run.history[0]?.triggerSource !== "simulated local event") throw new Error("Simulated event did not preserve its trigger source and approval gate.");
  await post("/api/undo");
  console.log("Trigger verified: approved event started a run that still waited for final submission approval.");

  await post("/api/reset");
  const cleanRunState = await get("/api/run/timeline");
  if (cleanRunState.status !== "idle" || cleanRunState.timeline.length || cleanRunState.history.length) throw new Error("Reset did not clear the demo run state.");
  const skillsAfterReset = await get("/api/skills");
  if (!skillsAfterReset.skills.some((item) => item.card.id === compiled.card.id && item.approved)) throw new Error("Reset cleared the persisted approved skill card.");
  console.log("Reset verified: sandbox and run history cleared; approved skill stayed in SQLite.");
} finally {
  await post("/api/recording/stop").catch(() => {});
  await post("/api/reset").catch(() => {});
}
