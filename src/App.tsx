import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, BadgeCheck, BookOpen, Check, ChevronRight, CircleHelp, Clock3, Command, Download, FileText, Gauge, History, LoaderCircle, Mic, PanelLeftClose, Play, Plus, Radio, RotateCcw, Send, Settings2, ShieldCheck, Sparkles, Square, Ticket, Upload, WandSparkles, X } from "lucide-react";
import { api, type CompileResult, type Recording, type RunInfo, type SandboxState, type TicketEvent } from "./api";

const defaultLesson = "Read today's student attendance table, calculate how many are Present, then write the count and a short summary to the DailyReport form. Pause for my approval before submitting. Verify the saved report.";
const idleSteps = ["Read today's attendance", "Calculate present students", "Prepare the daily report", "Pause for approval", "Verify the saved report"];
const stamp = (value?: string) => value ? new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";

export default function App() {
  const [state, setState] = useState<SandboxState | null>(null);
  const [info, setInfo] = useState<RunInfo>({ status: "idle", timeline: [], history: [] });
  const [compiled, setCompiled] = useState<CompileResult | null>(null);
  const [savedSkills, setSavedSkills] = useState<{ card: CompileResult["card"]; approved: boolean }[]>([]);
  const [message, setMessage] = useState("");
  const [lesson, setLesson] = useState(defaultLesson);
  const [teaching, setTeaching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nav, setNav] = useState("Overview");
  const [recording, setRecording] = useState<Recording>({ status: "idle", steps: [], narration: [] });
  const [narration, setNarration] = useState("");
  const [voiceOn, setVoiceOn] = useState(false);
  const [ticketEvents, setTicketEvents] = useState<TicketEvent[]>([]);
  const voiceRef = useRef<any>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, r, skills, tickets] = await Promise.all([api.state(), api.runInfo(), api.skills(), api.ticketEvents()]);
      setState(s); setInfo(r); setSavedSkills(skills.skills); setTicketEvents(tickets.events);
    } catch (error) { setMessage((error as Error).message); }
  }, []);
  useEffect(() => {
    if (!compiled && savedSkills[0]) setCompiled({ source: "saved", note: "Loaded from the local SQLite Skill Store.", card: savedSkills[0].card, approved: savedSkills[0].approved });
  }, [compiled, savedSkills]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const active = ["running", "awaiting_approval", "paused"].includes(info.status);
    const timer = window.setInterval(() => void refresh(), active ? 700 : 5000);
    return () => window.clearInterval(timer);
  }, [info.status, refresh]);
  useEffect(() => {
    const stream = new EventSource("/api/run/events");
    stream.onmessage = (event) => {
      try { const next = JSON.parse(event.data); setInfo((previous) => ({ ...previous, status: next.status, timeline: next.timeline })); }
      catch { /* Ignore malformed frames. */ }
    };
    return () => stream.close();
  }, []);
  useEffect(() => {
    const stream = new EventSource("/api/integrations/tickets/events");
    stream.onmessage = (event) => {
      try { const next = JSON.parse(event.data); if (Array.isArray(next.events)) setTicketEvents(next.events); }
      catch { /* Ignore malformed frames. */ }
    };
    return () => stream.close();
  }, []);
  useEffect(() => {
    if (!teaching) return;
    const poll = window.setInterval(() => api.recording().then(setRecording).catch(() => undefined), 700);
    return () => window.clearInterval(poll);
  }, [teaching]);

  const action = async (fn: () => Promise<unknown>, done?: () => void) => {
    setBusy(true); setMessage("");
    try { await fn(); done?.(); await refresh(); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  const teach = async () => {
    await action(async () => { const result = await api.compile({ mode: "guided", description: lesson, allowedPages: ["AttendanceTracker", "DailyReport"] }); setCompiled(result); setTeaching(false); setNav("My Skills"); });
  };
  const startRecording = async () => { await action(async () => { const result = await api.startRecording(); setRecording(result); setNarration(""); }); };
  const addNarration = async () => {
    const text = narration.trim(); if (!text) return;
    await action(async () => { setRecording(await api.narration(text)); setNarration(""); });
  };
  const stopAndCompileRecording = async () => {
    await action(async () => {
      const capture = await api.stopRecording(); setRecording(capture);
      const description = lesson.trim() || "Copy the present student count from AttendanceTracker into DailyReport and submit after approval.";
      const result = await api.compile({ mode: "recorded", description, recording: capture });
      setCompiled(result); setTeaching(false); setNav("My Skills");
    });
  };
  const toggleVoice = () => {
    if (voiceRef.current) { voiceRef.current.stop(); voiceRef.current = null; setVoiceOn(false); return; }
    const Speech = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Speech) { setMessage("Voice narration is unavailable in this browser. Type narration and press Add narration."); return; }
    const recognition = new Speech(); recognition.continuous = true; recognition.interimResults = false;
    recognition.onresult = async (event: any) => {
      const text = event.results?.[event.results.length - 1]?.[0]?.transcript?.trim();
      if (text) { const at = new Date().toISOString(); setRecording((previous) => ({ ...previous, narration: [...(previous.narration ?? []), { at, text }] })); try { await api.narration(text, at); } catch {} }
    };
    recognition.onerror = () => { setVoiceOn(false); voiceRef.current = null; };
    recognition.onend = () => { setVoiceOn(false); voiceRef.current = null; };
    recognition.start(); voiceRef.current = recognition; setVoiceOn(true);
  };
  const saveEditedCard = async () => {
    if (!compiled) return;
    await action(async () => { const saved = await api.saveSkill(compiled.card); setCompiled({ ...compiled, card: saved.card, approved: saved.approved }); setSavedSkills((items) => [{ card: saved.card, approved: saved.approved }, ...items.filter((item) => item.card.id !== saved.card.id)]); setMessage(saved.approved ? "Saved. This exact card is already approved." : "Saved. Review and approve this card before running it."); });
  };
  const approveSkill = async () => {
    if (!compiled) return;
    await action(async () => { const saved = await api.saveSkill(compiled.card); const approved = await api.approveSkill(saved.card.id); setCompiled({ ...compiled, card: approved.card, approved: true }); setSavedSkills((items) => [{ card: approved.card, approved: true }, ...items.filter((item) => item.card.id !== approved.card.id)]); setMessage("Skill approved. Runs still pause for your final submit confirmation."); });
  };
  const exportSkill = () => {
    if (!compiled) return;
    const blob = new Blob([JSON.stringify(compiled.card, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `${compiled.card.id}.json`; anchor.click(); URL.revokeObjectURL(url);
  };
  const importSkill = async (file?: File) => {
    if (!file) return;
    await action(async () => {
      const parsed = JSON.parse(await file.text());
      const card = { ...parsed, id: `import-${Date.now()}`, createdAt: new Date().toISOString(), requiresApproval: true } as CompileResult["card"];
      const saved = await api.saveSkill(card);
      setCompiled({ source: "saved", note: "Imported Skill Card; approval has been reset.", card: saved.card, approved: false });
      setSavedSkills((items) => [{ card: saved.card, approved: false }, ...items.filter((item) => item.card.id !== saved.card.id)]);
      setMessage("Skill imported. Review and approve it before running.");
    });
  };
  const start = async (approveIfNeeded = true) => {
    await action(async () => {
      let current = compiled;
      if (!current) { current = await api.compile({ mode: "guided", description: defaultLesson }); setCompiled(current); }
      let saved = await api.saveSkill(current.card);
      if (!saved.approved && approveIfNeeded) saved = await api.approveSkill(saved.card.id);
      if (!saved.approved) throw new Error("Approve the Skill Card before running its dry preview.");
      setCompiled({ ...current, card: saved.card, approved: true });
      setSavedSkills((items) => [{ card: saved.card, approved: true }, ...items.filter((item) => item.card.id !== saved.card.id)]);
      await api.run(saved.card.id); setNav("Run History");
    });
  };
  const openSkill = () => action(async () => {
    if (!compiled) setCompiled(await api.compile({ mode: "guided", description: defaultLesson }));
    setNav("My Skills");
  });

  const present = state?.students.filter((s) => s.status === "Present").length ?? 0;
  const running = ["running", "awaiting_approval", "paused"].includes(info.status);
  const ready = info.status === "awaiting_approval";
  const lastRun = info.history[0];
  const saved = state?.report;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-icon"><Sparkles size={17} strokeWidth={2.4} /></span><span>The Understudy<small>WORKFLOW APPRENTICE</small></span><button className="icon-button sidebar-collapse" aria-label="Collapse sidebar"><PanelLeftClose size={17} /></button></div>
      <div className="side-label">WORKSPACE</div>
      <nav>{[["Overview", Gauge], ["My Skills", BookOpen], ["Run History", History]].map(([name, Icon]: any) => <button key={name} onClick={() => name === "My Skills" ? void openSkill() : setNav(name)} className={`nav-item ${nav === name ? "selected" : ""}`}><Icon size={17} /><span>{name}</span>{name === "My Skills" && <span className="nav-count">{savedSkills.length || (compiled ? 1 : "—")}</span>}</button>)}</nav>
      <div className="side-label environment-label">ENVIRONMENT</div>
      <button className={`nav-item ${nav === "Demo Environment" ? "selected" : ""}`} onClick={() => setNav("Demo Environment")}><Settings2 size={17} /><span>Demo sandbox</span></button>
      <div className="sidebar-spacer" />
      <div className="sidebar-demo"><div className="demo-line"><span className="live-dot" /> Local sandbox <span className="tiny-chevron">⌄</span></div><small>2 connected demo apps</small></div>
      <div className="profile"><div className="avatar">U</div><span><b>Understudy workspace</b><small>Local demo environment</small></span><CircleHelp size={16} className="profile-help" /></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumb">Workspace <ChevronRight size={13} /> <b>{nav}</b></div><div className="top-actions"><span className="env-pill"><span className="live-dot" /> Sandbox connected</span><button className="avatar small-avatar">U</button></div></header>
      <div className="content">
        <div className="eyebrow"><span className="eyebrow-line" /> YOUR AUTOMATION WORKSPACE</div>
        <div className="heading-row"><div><h1>Your workflows, <em>handled.</em></h1><p className="intro">Show it once. Review what it learned. Let it take care of the repeat work.</p></div><button className="button-primary teach-button" onClick={() => setTeaching(true)}><Plus size={17} /> Teach a new skill <span className="shortcut">⌘ K</span></button></div>
        <p className="scope-note"><b>Prototype limits:</b> the only workflow this version can actually run is AttendanceTracker → DailyReport. You can make a draft Skill Card for another task, but it will not automate that task yet. Live recording is limited to the two demo pages.</p>

        {message && <div className="toast-error"><X size={16} />{message}<button onClick={() => setMessage("")} aria-label="Dismiss"><X size={15} /></button></div>}

        <div className="overview-grid">
          <section className="panel skill-panel">
            <div className="section-head"><div className="section-title"><span className="section-icon"><WandSparkles size={17} /></span><div><div className="eyebrow small-eyebrow">FEATURED SKILL</div><h2>{compiled?.card.title ?? "Generate Daily Attendance Report"}</h2></div></div><span className="status-pill ready-pill"><span className="live-dot" />{compiled ? (compiled.approved ? "Approved" : "Card needs approval") : "Built-in demo skill"}</span></div>
            <p className="skill-description">{compiled?.card.description ?? "Read attendance, calculate the present count, and prepare a verified daily report."}</p>
            <div className="skill-flow">{(compiled?.card.steps.map((step) => step.instruction) ?? idleSteps).slice(0, 5).map((step, i) => <div className="flow-step" key={`${i}-${step}`}><span className={`step-mark ${i === 3 ? "approval-mark" : ""}`}>{i === 3 ? <ShieldCheck size={14} /> : String(i + 1).padStart(2, "0")}</span><span>{step}</span>{i < 4 && <span className="flow-dash" />}</div>)}</div>
            <div className="skill-meta"><span><ShieldCheck size={14} /> Human approval before submit</span><span><Command size={14} /> 2 allowed sandbox pages</span><span className={`compiler-source ${compiled?.source === "openai" ? "ai-source" : ""}`}><Sparkles size={14} /> {compiled?.source === "openai" ? "AI compiled" : compiled?.source === "saved" ? "Saved Skill Card" : compiled ? "Fallback compiled" : "Built-in demo skill"}</span></div>
            <div className="panel-footer"><button className="button-quiet" onClick={() => void openSkill()}><FileText size={15} /> Review skill card</button><div className="footer-actions"><button className="button-secondary" disabled={busy || running} onClick={() => start(true)}><Play size={14} fill="currentColor" /> Approve &amp; run</button><button className="icon-button more-button" onClick={() => void openSkill()} aria-label="Edit skill"><Settings2 size={16} /></button></div></div>
          </section>

          <section className="panel run-panel">
            <div className="section-head"><div className="section-title"><span className="section-icon muted-icon"><Activity size={17} /></span><div><div className="eyebrow small-eyebrow">LATEST EXECUTION</div><h2>{running ? (ready ? "Approval needed" : info.status === "paused" ? "Run paused" : "Working through the task") : lastRun ? lastRun.status : "No runs yet"}</h2></div></div>{running && <span className="run-indicator"><span className="pulse-dot" /> LIVE</span>}</div>
            <div className="run-progress"><div className="progress-track"><span style={{ width: `${info.timeline.length ? Math.min(100, Math.round(info.timeline.filter((t) => ["done", "recovery"].includes(t.status)).length / 8 * 100)) : 0}%` }} /></div><span>{running ? `${info.timeline.filter((t) => ["done", "recovery"].includes(t.status)).length} / 8 steps` : lastRun ? stamp(lastRun.startedAt) : "Ready when you are"}</span></div>
            {(running || info.timeline.length > 0) && <div className="runner-preview"><div className="preview-label"><span className="pulse-dot" /> LIVE TARGET · DailyReport <small>local sandbox</small></div><iframe title="Understudy live target preview" src="/sandbox/report?ghost=1" /></div>}
            <div className="live-timeline">{(info.timeline.length ? [...info.timeline].slice(-5) : [{ step: "Your next run will appear here", status: "waiting", detail: "Live browser actions, approval, and verification." } as any]).map((entry, i) => <div className={`timeline-row ${entry.status}`} key={`${entry.t ?? "idle"}-${i}`}><span className="timeline-icon">{entry.status === "done" ? <Check size={12} /> : entry.status === "recovery" ? <WandSparkles size={12} /> : entry.status === "error" ? <X size={12} /> : entry.status === "running" ? <LoaderCircle size={12} className="spin" /> : <span className="timeline-dot" />}</span><div className="timeline-copy"><b>{entry.step}</b>{entry.detail && <small>{entry.detail}</small>}</div><time>{entry.t ? stamp(entry.t) : ""}</time></div>)}</div>
            {(ready || info.status === "paused") && <div className="approval-card"><div className="approval-copy"><span className="approval-shield"><ShieldCheck size={17} /></span><span><b>{info.status === "paused" ? "Run paused before submission" : `Ready to submit: ${present} students present`}</b><small>{info.status === "paused" ? "The report is still waiting for your explicit approval." : "Review the report, then approve this action."}</small></span></div><div className="approval-actions">{ready ? <><button className="button-secondary" onClick={() => action(() => api.toggleUi())}><WandSparkles size={14} /> Trigger interface change</button><button className="button-quiet" onClick={() => action(() => api.pause())}><span className="pause-glyph">Ⅱ</span> Pause</button><button className="button-primary" onClick={() => action(() => api.approve())}><Check size={15} /> Approve submission</button></> : <><button className="button-secondary" onClick={() => action(() => api.resume())}><Play size={14} /> Resume to review</button><button className="button-quiet stop-button" onClick={() => action(() => api.stop())}><Square size={13} /> Stop run</button></>}</div></div>}
            {running && !ready && info.status !== "paused" && <div className="run-controls"><button className="button-quiet stop-button" onClick={() => action(() => api.stop())}><Square size={13} /> Stop run</button></div>}
            {!running && lastRun && <div className="run-result-line"><span className={lastRun.verification ? "result-good" : "result-bad"}>{lastRun.verification ? <BadgeCheck size={16} /> : <X size={15} />} {lastRun.verification ? "Result verified" : "Verification incomplete"}</span><span>{lastRun.recovery ? "Interface recovery used" : "No recovery needed"}</span></div>}
          </section>
        </div>

        <div className="lower-grid">
          <section className="panel activity-panel"><div className="section-head"><div><div className="eyebrow small-eyebrow">SANDBOX STATE</div><h2>Two apps, one workflow</h2></div><a href="/sandbox/attendance" target="_blank" rel="noreferrer" className="text-link">Open sandbox <ArrowUpRight size={14} /></a></div><div className="apps-grid"><div className="app-tile"><div className="app-tile-top"><span className="app-symbol attendance-symbol">AT</span><span className="connected-dot" /></div><b>AttendanceTracker</b><small>Class roster · live page data</small><div className="tile-metric"><strong>{present}<i> / {state?.students.length ?? 10}</i></strong><span>present today</span></div><a href="/sandbox/attendance" target="_blank" rel="noreferrer">View records <ArrowUpRight size={12} /></a></div><div className="app-tile"><div className="app-tile-top"><span className="app-symbol report-symbol">DR</span><span className="connected-dot" /></div><b>DailyReport</b><small>Report form · reversible sandbox</small><div className="tile-metric"><strong className="report-status">{saved?.status ?? "Draft"}</strong><span>{saved?.count == null ? "waiting for a run" : `${saved.count} students recorded`}</span></div><a href="/sandbox/report" target="_blank" rel="noreferrer">View report <ArrowUpRight size={12} /></a></div></div></section>

          <section className="panel history-panel"><div className="section-head"><div><div className="eyebrow small-eyebrow">RECENT ACTIVITY</div><h2>Run history</h2></div><button className="text-link as-button" onClick={() => setNav("Run History")}>View all <ArrowUpRight size={14} /></button></div>{info.history.length ? <div className="history-list">{info.history.slice(0, 4).map((run, i) => <div className="history-row" key={`${run.startedAt}-${i}`}><span className={`history-mark ${run.verification ? "verified" : ""}`}>{run.verification ? <Check size={13} /> : <Clock3 size={13} />}</span><span className="history-name"><b>{run.title}</b><small>{stamp(run.startedAt)} · {run.status}{run.recovery ? " · recovered" : ""}</small></span><span className={run.verification ? "history-verified" : "history-pending"}>{run.verification ? "Verified" : run.status}</span></div>)}</div> : <div className="empty-history"><span className="empty-history-icon"><History size={17} /></span><span><b>Your runs will show up here</b><small>Each run keeps its result and recovery notes.</small></span></div>}<div className="history-footer"><span><span className="history-pip" /> {info.history.length} saved {info.history.length === 1 ? "run" : "runs"}</span><button className="button-quiet" onClick={() => action(() => api.reset())}><RotateCcw size={14} /> Reset demo</button></div></section>
        </div>

        <section className="panel ticket-panel">
          <div className="section-head"><div className="section-title"><span className="section-icon muted-icon"><Radio size={17} /></span><div><div className="eyebrow small-eyebrow">REAL-TIME DATA · HELPDESK WEBHOOK</div><h2>Incoming support tickets</h2></div></div><span className="status-pill ready-pill"><span className="live-dot" /> WEBHOOK READY</span></div>
          <p className="ticket-intro">Ticket events stream into this inbox as they arrive. This adapter only receives and displays data; it never changes a ticket or sends a reply.</p>
          <div className="ticket-toolbar"><code>POST /api/integrations/tickets/webhook</code><button className="button-secondary" disabled={busy} onClick={() => action(async () => { const result = await api.sampleTicket(); setMessage(`Received ticket ${result.event.ticketId} over the local webhook adapter.`); })}><Ticket size={14} /> Send sample ticket</button></div>
          {ticketEvents.length ? <div className="ticket-list">{ticketEvents.slice(0, 5).map((ticket) => <article className="ticket-row" key={ticket.eventId}><span className={`ticket-priority priority-${ticket.priority}`}>{ticket.priority}</span><span className="ticket-copy"><b>{ticket.title}</b><small>{ticket.ticketId} · {ticket.status} · {ticket.source}</small></span><time>{stamp(ticket.receivedAt)}</time></article>)}</div> : <div className="ticket-empty"><Ticket size={16} /><span>No incoming events yet. Send a sample or connect a helpdesk webhook.</span></div>}
          <small className="ticket-footnote">External services need a reachable HTTPS endpoint and <code>UNDERSTUDY_WEBHOOK_SECRET</code>. Map the provider’s payload to ticket id, subject, priority, and status.</small>
        </section>

        {state?.snapshot && <section className="panel diff-panel"><div className="section-head"><div><div className="eyebrow small-eyebrow">SANDBOX CHANGESET</div><h2>Before &amp; after</h2></div><button className="button-secondary undo-button" onClick={() => action(() => api.undo())}><RotateCcw size={14} /> Undo last run</button></div><div className="diff-table"><div className="diff-heading"><span>FIELD</span><span>BEFORE</span><span>AFTER</span></div><div className="diff-row"><b>Present count</b><span>{state.snapshot.count ?? "Empty"}</span><span className="diff-after">{saved?.count ?? "Empty"}<ArrowDownRight size={13} /></span></div><div className="diff-row"><b>Report note</b><span className="diff-note">{state.snapshot.note || "Empty"}</span><span className="diff-after diff-note">{saved?.note || "Empty"}</span></div><div className="diff-row"><b>Submission status</b><span>{state.snapshot.status}</span><span className="diff-after">{saved?.status ?? "Draft"}</span></div></div><small className="undo-note">Undo restores this local sandbox report to its captured state.</small></section>}

        {nav === "My Skills" && <section className="panel skill-editor"><div className="section-head"><div><div className="eyebrow small-eyebrow">EDITABLE SKILL CARD</div><h2>What the system learned</h2></div><span className="status-pill ready-pill">{compiled?.approved ? "Approved" : compiled?.source === "openai" ? "AI compiled · approval needed" : compiled?.source === "saved" ? "Saved card · status loaded" : "Fallback compiled · approval needed"}</span></div><label className="field-label">Skill title<input value={compiled?.card.title ?? "Generate Daily Attendance Report"} onChange={(e) => compiled && setCompiled({ ...compiled, approved: false, card: { ...compiled.card, title: e.target.value } })} /></label><label className="field-label">Description<textarea value={compiled?.card.description ?? "Read attendance, calculate the present count, and prepare a verified daily report."} onChange={(e) => compiled && setCompiled({ ...compiled, approved: false, card: { ...compiled.card, description: e.target.value } })} /></label><div className="detail-grid"><div><span className="detail-label">ALLOWED DOMAINS</span><p>{compiled?.card.allowedDomains.join(", ") ?? "localhost:8787"}</p></div><div><span className="detail-label">PARAMETERS</span><p className="parameter-chips">{(compiled?.card.parameters ?? []).map((param) => <span className="parameter-chip" key={param.name}>{param.name}</span>)}</p></div><div><span className="detail-label">TRIGGER / APPROVAL</span><p>{compiled?.card.trigger ?? "Manual"} · person approves every final submit</p></div></div><h3>Editable workflow steps</h3><ol className="editable-steps">{(compiled?.card.steps ?? []).map((step, i) => <li key={i}><span>{String(i + 1).padStart(2, "0")}</span><textarea value={step.instruction} onChange={(e) => { if (!compiled) return; const steps = [...compiled.card.steps]; steps[i] = { ...steps[i], instruction: e.target.value }; setCompiled({ ...compiled, approved: false, card: { ...compiled.card, steps } }); }} /><div className="confidence-line"><span>{Math.round(step.confidence * 100)}% confidence{step.requiresConfirmation ? " · approval required" : ""}</span><i style={{ width: `${Math.round(step.confidence * 100)}%` }} /></div></li>)}</ol><div className="skill-actions"><button className="button-secondary" disabled={busy || running} onClick={saveEditedCard}><FileText size={14} /> Save edits</button><button className="button-quiet" onClick={exportSkill}><Download size={14} /> Export</button><input id="skill-import" className="hidden-file" type="file" accept="application/json,.json" onChange={(e) => { const file = e.currentTarget.files?.[0]; void importSkill(file); e.currentTarget.value = ""; }} /><label className="button-quiet" htmlFor="skill-import"><Upload size={14} /> Import</label>{!compiled?.approved && <button className="button-secondary" disabled={busy || running} onClick={approveSkill}><ShieldCheck size={14} /> Approve skill</button>}<button className="button-primary" disabled={busy || running || !compiled?.approved} onClick={() => start(false)}><Play size={14} /> Dry-run preview &amp; review</button>{compiled?.approved && <button className="button-quiet" disabled={busy || running} onClick={() => action(async () => { await api.simulateEvent(compiled.card.id); setNav("Run History"); })}><Activity size={14} /> Simulate event</button>}</div><small className="trust-note">Runner actions are constrained to the fixed AttendanceTracker → DailyReport workflow. Editing card text changes the reviewed instructions; unsupported actions cannot expand browser scope.</small></section>}

        {nav === "Run History" && <section className="panel full-history"><div className="eyebrow small-eyebrow">EXECUTION LOG</div><h2>Run history</h2>{info.history.length ? info.history.map((run, i) => <div className="full-history-row" key={`${run.startedAt}-${i}`}><div><b>{run.title}</b><small>{new Date(run.startedAt).toLocaleString()} · {run.triggerSource || "manual"} · {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "duration unavailable"}</small></div><span>{run.expected?.count ?? "—"} present</span><span>{run.verification ? "Verified" : "Not verified"}</span><span>{run.repairs?.length ? `${run.repairs.length} repair(s)` : run.recovery ? "Recovery used" : "No repairs"}</span></div>) : <p className="muted-copy">No runs yet. Start the featured skill to create the first activity record.</p>}</section>}

        <footer className="page-footer"><span>THE UNDERSTUDY <i>·</i> LIVE LOCAL RECORDER</span><span>SQLite history <i>·</i> Agents API / MCP / native panel mocked</span></footer>
      </div>
    </main>

    {teaching && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && recording.status !== "recording") setTeaching(false); }}><section className="teach-modal"><div className="modal-top"><span className="modal-icon"><Sparkles size={18} /></span><button className="icon-button" onClick={() => setTeaching(false)} aria-label="Close" disabled={recording.status === "recording"}><X size={18} /></button></div>
      {recording.status === "recording" ? <><div className="eyebrow small-eyebrow">LIVE BROWSER RECORDING</div><h2>Show the demo workflow once</h2><p>A separate browser window is open on AttendanceTracker. Recording only supports the two demo apps; it cannot learn actions on other websites yet.</p><div className="recording-live"><span className="pulse-dot" /> Recording · {recording.steps.length} captured steps <span className="allowed-origin">localhost only</span></div><div className="recorded-steps">{recording.steps.slice(-6).map((step, i) => <div className="recorded-row" key={`${step.at}-${i}`}><span className="recorded-type">{step.type}</span><span><b>{step.target || step.visibleText || "Page action"}</b><small>{step.selector} {step.value ? `· “${step.value}”` : ""}</small></span>{step.screenshot && <a href={step.screenshot} target="_blank" rel="noreferrer">View</a>}</div>)}{!recording.steps.length && <div className="record-empty">Use the opened browser to navigate, fill the report, and submit the demo task.</div>}</div><label className="field-label">Narration, matched to what you just did<input value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="e.g. now I copy the present total" onKeyDown={(e) => e.key === "Enter" && void addNarration()} /></label><div className="modal-actions"><button className={`button-secondary ${voiceOn ? "recording-button" : ""}`} onClick={toggleVoice}><Mic size={14} /> {voiceOn ? "Stop voice" : "Voice narration"}</button><button className="button-quiet" onClick={() => void addNarration()} disabled={!narration.trim()}>Add narration</button><button className="button-primary" disabled={busy} onClick={stopAndCompileRecording}><Square size={13} /> Stop &amp; compile</button></div></> : <><div className="eyebrow small-eyebrow">TEACH MODE</div><h2>Create a skill card</h2><p>The runnable demo is attendance → report only. A different description creates an editable draft, but cannot automate that task yet.</p><label className="field-label">Describe the task<textarea rows={4} value={lesson} onChange={(e) => setLesson(e.target.value)} placeholder="For example: check today's attendance, count who is present, and prepare the daily report…" /></label><div className="teach-honesty"><BookOpen size={15} /><span><b>What works today</b><small>Record the attendance-to-report demo in the local browser, or create a draft Skill Card from a description. Other websites and workflows are not runnable yet.</small></span></div><div className="modal-actions"><button className="button-quiet" onClick={() => setTeaching(false)}>Cancel</button><button className="button-secondary" disabled={busy} onClick={startRecording}><Activity size={14} /> Record demo task</button><button className="button-primary" disabled={busy || !lesson.trim()} onClick={teach}>{busy ? <LoaderCircle size={15} className="spin" /> : <Send size={15} />} Create draft card <ChevronRight size={15} /></button></div></>}</section></div>}
  </div>;
}
