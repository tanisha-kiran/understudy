export type Report = { count: number | null; note: string; status: string };
export type SandboxState = {
  students: { name: string; status: string }[];
  report: Report;
  submitLabel: string;
  snapshot: Report | null;
  runs: RunRecord[];
  snapshotId?: string | null;
};
export type Step = {
  instruction: string;
  actionType: "navigate" | "read_table" | "compute" | "fill" | "click" | "verify";
  target: string;
  selector?: string;
  fallbackDescription?: string;
  confidence: number;
  requiresConfirmation: boolean;
};
export type RunRecord = { id?: string; title: string; startedAt: string; finishedAt?: string; durationMs?: number; status: string; verification?: boolean; recovery?: boolean; repairs?: { from: string; to: string; reason: string }[]; triggerSource?: string; expected?: { count: number; note: string; total: number }; actual?: Report };
export type TimelineEntry = { t: string; step: string; status: "done" | "running" | "waiting" | "recovery" | "error"; detail?: string };
export type RunInfo = { status: string; timeline: TimelineEntry[]; history: RunRecord[] };
export type SkillCard = {
  id: string;
  title: string;
  description: string;
  allowedDomains: string[];
  steps: Step[];
  successCheck: string;
  requiresApproval: boolean;
  trigger?: string;
  parameters?: { name: string; description: string; source: string }[];
  createdAt?: string;
};
export type CompileResult = { source: "openai" | "fallback" | "saved"; note?: string; card: SkillCard; approved?: boolean };
export type RecordingStep = { at: string; type: string; url: string; target: string; selector: string; visibleText: string; value?: string; screenshot?: string };
export type Recording = { id?: string; status: "idle" | "recording" | "complete"; createdAt?: string; finishedAt?: string; steps: RecordingStep[]; narration?: { at: string; text: string }[]; allowedOrigin?: string };
export type TicketEvent = { eventId: string; ticketId: string; title: string; priority: string; status: string; source: string; receivedAt: string; occurredAt: string | null; deduplicated?: boolean };

const j = async <T,>(url: string, method = "GET", body?: unknown): Promise<T> => {
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error ?? r.statusText);
  return data as T;
};

export const api = {
  state: () => j<SandboxState>("/api/state"),
  reset: () => j<SandboxState>("/api/reset", "POST"),
  toggleUi: () => j<{ submitLabel: string }>("/api/interface-change", "POST"),
  compile: (input: unknown) => j<CompileResult>("/api/compile", "POST", input),
  skills: () => j<{ skills: { card: SkillCard; approved: boolean }[] }>("/api/skills"),
  saveSkill: (card: SkillCard) => j<{ card: SkillCard; approved: boolean }>("/api/skills", "POST", { card }),
  approveSkill: (id: string) => j<{ card: SkillCard; approved: boolean }>(`/api/skills/${encodeURIComponent(id)}/approve`, "POST"),
  undo: () => j<Report>("/api/undo", "POST"),
  run: (skillId: string, triggerSource = "manual") => j<{ status: string }>("/api/run", "POST", { skillId, triggerSource }),
  simulateEvent: (skillId: string) => j<{ status: string }>("/api/triggers/simulate", "POST", { skillId }),
  runInfo: () => j<RunInfo>("/api/run/timeline"),
  approve: () => j<{ status: string }>("/api/run/approve", "POST"),
  pause: () => j<{ status: string }>("/api/run/pause", "POST"),
  resume: () => j<{ status: string }>("/api/run/resume", "POST"),
  stop: () => j<{ status: string }>("/api/run/stop", "POST"),
  recording: () => j<Recording>("/api/recording"),
  startRecording: (startPath = "/sandbox/attendance") => j<Recording>("/api/recording/start", "POST", { startPath }),
  narration: (text: string, at = new Date().toISOString()) => j<Recording>("/api/recording/narration", "POST", { text, at }),
  stopRecording: () => j<Recording>("/api/recording/stop", "POST"),
  audit: () => j<{ entries: { at: string; event: string; detail: Record<string, unknown> }[]; storage: { type: string; durable: boolean } }>("/api/audit"),
  ticketEvents: () => j<{ adapter: string; authentication: string; events: TicketEvent[] }>("/api/integrations/tickets"),
  sampleTicket: () => j<{ event: TicketEvent; deduplicated: boolean }>("/api/integrations/tickets/sample", "POST", {}),
};
