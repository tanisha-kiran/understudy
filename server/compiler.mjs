import { z } from "zod";
import OpenAI from "openai";

export const demoDomain = `localhost:${process.env.PORT || 8787}`;

// Skill Card schema. Every compiled card is validated against this before the UI sees it.
export const StepSchema = z.object({
  instruction: z.string(),
  actionType: z.enum(["navigate", "read_table", "compute", "fill", "click", "verify"]),
  target: z.string(),
  selector: z.string().optional(),
  fallbackDescription: z.string().optional(),
  confidence: z.number().min(0).max(1),
  requiresConfirmation: z.boolean(),
});

export const SkillCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  trigger: z.string(),
  allowedDomains: z.array(z.string()),
  parameters: z.array(z.object({ name: z.string(), description: z.string(), source: z.string() })),
  steps: z.array(StepSchema),
  successCheck: z.string(),
  requiresApproval: z.boolean(),
  createdAt: z.string(),
});

// Deterministic fallback. It is labelled "fallback" in the response and must be shown as such in the UI.
export const fallbackCard = () => ({
  id: "daily-attendance-report",
  title: "Generate Daily Attendance Report",
  description: "Count present students in AttendanceTracker and submit the total in DailyReport.",
  trigger: "Manual",
  allowedDomains: [demoDomain],
  parameters: [
    { name: "presentCount", description: "Number of students marked Present", source: "AttendanceTracker table" },
    { name: "note", description: "Short attendance summary", source: "Derived from presentCount" },
  ],
  steps: [
    { instruction: "Open AttendanceTracker", actionType: "navigate", target: "/sandbox/attendance", confidence: 0.98, requiresConfirmation: false },
    { instruction: "Read every student row", actionType: "read_table", target: "attendance table", selector: "#attendance-table tbody tr", confidence: 0.95, requiresConfirmation: false },
    { instruction: "Count rows marked Present", actionType: "compute", target: "presentCount", confidence: 0.95, requiresConfirmation: false },
    { instruction: "Open DailyReport", actionType: "navigate", target: "/sandbox/report", confidence: 0.98, requiresConfirmation: false },
    { instruction: "Enter the present count", actionType: "fill", target: "Present count", selector: "#count", fallbackDescription: "Numeric field labelled Present count", confidence: 0.93, requiresConfirmation: false },
    { instruction: "Enter the report note", actionType: "fill", target: "Report note", selector: "#note", fallbackDescription: "Text area labelled Report note", confidence: 0.9, requiresConfirmation: false },
    { instruction: "Click the Submit button", actionType: "click", target: "Submit", selector: "button:has-text('Submit')", fallbackDescription: "Primary button that submits the report", confidence: 0.9, requiresConfirmation: true },
    { instruction: "Check the saved report matches the entered values", actionType: "verify", target: "/api/state report", confidence: 0.9, requiresConfirmation: false },
  ],
  successCheck: "Report status is Submitted and the saved count equals the computed present count.",
  requiresApproval: true,
  createdAt: new Date().toISOString(),
});

const narrationFor = (recording, step) => {
  const voice = recording?.narration ?? [];
  const stepTime = Date.parse(step.at || 0);
  return [...voice].reverse().find((item) => Math.abs(Date.parse(item.at || 0) - stepTime) < 12_000)?.text;
};

export const compileRecordingFallback = (input = {}) => {
  const recording = input.recording;
  if (!recording?.steps?.length) return fallbackCard();
  const allowedPages = new Set(["/sandbox/attendance", "/sandbox/report"]);
  const allowedSelectors = new Set(["#attendance-table tbody tr", "#count", "#note", "#submit-btn"]);
  const steps = [];
  const params = new Map();
  for (const captured of recording.steps) {
    const page = (() => { try { return new URL(captured.url).pathname; } catch { return ""; } })();
    if (captured.type === "navigate" && allowedPages.has(page)) {
      steps.push({ instruction: page.endsWith("attendance") ? "Open AttendanceTracker" : "Open DailyReport", actionType: "navigate", target: page, confidence: 0.98, requiresConfirmation: false });
    } else if (captured.type === "input" || captured.type === "change") {
      const selector = allowedSelectors.has(captured.selector) ? captured.selector : null;
      if (!selector || !["#count", "#note"].includes(selector)) continue;
      const paramName = selector === "#count" ? "presentCount" : "note";
      const described = narrationFor(recording, captured);
      const instruction = described || (selector === "#count" ? "Enter the present count" : "Enter the report note");
      const value = String(captured.value ?? "");
      if (value) params.set(paramName, { name: paramName, description: selector === "#count" ? "Number of students marked Present" : "Short summary entered in DailyReport", source: "Recorded task; expected to change on a future run" });
      steps.push({ instruction, actionType: "fill", target: selector === "#count" ? "Present count" : "Report note", selector, fallbackDescription: selector === "#count" ? "Numeric field labelled Present count" : "Text area labelled Report note", confidence: 0.9, requiresConfirmation: false });
    } else if (captured.type === "click" && (captured.selector === "#submit-btn" || /submit|send report/i.test(captured.target || captured.visibleText || ""))) {
      steps.push({ instruction: narrationFor(recording, captured) || "Submit the prepared report after approval", actionType: "click", target: "Submit", selector: "#submit-btn", fallbackDescription: "Primary report form submission button", confidence: 0.86, requiresConfirmation: true });
    }
  }
  const base = fallbackCard();
  const unique = steps.filter((step, i) => step.actionType !== "navigate" || i === 0 || steps[i - 1]?.target !== step.target);
  return {
    ...base,
    id: `skill-${Date.now()}`,
    title: input.title || (input.description?.slice(0, 72) || "Recorded Daily Attendance Workflow"),
    description: input.description || "Recorded in the local AttendanceTracker and DailyReport demo apps.",
    parameters: [...params.values()],
    steps: unique.length ? unique : base.steps,
    createdAt: new Date().toISOString(),
  };
};

const outputSchema = {
  type: "object", additionalProperties: false,
  required: ["title", "description", "trigger", "allowedDomains", "parameters", "steps", "successCheck", "requiresApproval"],
  properties: {
    title: { type: "string" }, description: { type: "string" }, trigger: { type: "string" },
    allowedDomains: { type: "array", items: { type: "string", enum: [demoDomain] } },
    parameters: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "description", "source"], properties: { name: { type: "string" }, description: { type: "string" }, source: { type: "string" } } } },
    steps: { type: "array", items: { type: "object", additionalProperties: false, required: ["instruction", "actionType", "target", "selector", "fallbackDescription", "confidence", "requiresConfirmation"], properties: {
      instruction: { type: "string" }, actionType: { type: "string", enum: ["navigate", "read_table", "compute", "fill", "click", "verify"] }, target: { type: "string" }, selector: { type: "string" }, fallbackDescription: { type: "string" }, confidence: { type: "number" }, requiresConfirmation: { type: "boolean" },
    } } },
    successCheck: { type: "string" }, requiresApproval: { type: "boolean" },
  },
};

export async function compile(teachInput = {}) {
  const fallback = () => SkillCardSchema.parse(compileRecordingFallback(teachInput));
  if (!process.env.OPENAI_API_KEY) return { source: "fallback", note: "No OPENAI_API_KEY configured. This deterministic result was not generated by AI.", card: fallback() };
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_schema", json_schema: { name: "understudy_skill_card", strict: true, schema: outputSchema } },
      messages: [
        { role: "system", content: `Compile the user's task description and optional local browser recording into a safe Skill Card for The Understudy attendance/report demo. Only use ${demoDomain} and supported actions: navigate, read_table, compute, fill, click, verify. Never introduce credentials, external URLs, or unsupported actions. Always require human approval for submission. Use only selectors and page paths in this allowlist: /sandbox/attendance, /sandbox/report, #attendance-table tbody tr, #count, #note, #submit-btn. Treat changed values as parameters and stable labels/actions as constants. Use narration when it is timestamp-aligned with a recorded action.` },
        { role: "user", content: JSON.stringify(teachInput) },
      ],
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("The model returned no Skill Card.");
    const candidate = JSON.parse(content);
    const card = SkillCardSchema.parse({ ...candidate, id: `skill-${Date.now()}`, createdAt: new Date().toISOString(), allowedDomains: [demoDomain] });
    // Keep the runner's target fixed to supported sandbox pages, even if model wording varies.
    for (const step of card.steps) {
      if (step.actionType === "navigate" && !["/sandbox/attendance", "/sandbox/report"].includes(step.target)) throw new Error("The model proposed an unsupported sandbox path.");
      if (step.selector && !["#attendance-table tbody tr", "#count", "#note", "#submit-btn"].includes(step.selector)) throw new Error("The model proposed an unsupported selector.");
      if (!["navigate", "read_table", "compute", "fill", "click", "verify"].includes(step.actionType)) throw new Error("The model proposed an unsupported action.");
    }
    return { source: "openai", note: "Compiled with OpenAI and validated against the supported sandbox actions.", card };
  } catch (error) {
    return { source: "fallback", note: `OpenAI compilation failed; showing the deterministic fallback instead (${error?.message ?? "unknown error"}).`, card: fallback() };
  }
}
