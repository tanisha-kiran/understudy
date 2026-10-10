// App state is cached in memory for fast sandbox reads and persisted through StoreAdapter.
// The runner still reads attendance from the page DOM, never from this module.
import { store } from "./store.mjs";

const STUDENTS = [
  ["Aarav Mehta", "Present"],
  ["Diya Nair", "Present"],
  ["Kabir Rao", "Absent"],
  ["Meera Iyer", "Present"],
  ["Rohan Gupta", "Present"],
  ["Sana Khan", "Absent"],
  ["Vihaan Shetty", "Present"],
  ["Ananya Das", "Present"],
  ["Ishaan Reddy", "Present"],
  ["Tara Menon", "Absent"],
];

const fresh = () => ({
  students: STUDENTS.map(([name, status]) => ({ name, status })),
  report: { count: null, note: "", status: "Draft" },
  submitLabel: "Submit", // flipped to "Send Report" by the interface-change toggle
  snapshot: null, // report state captured before the last run, for undo
  preview: { active: false, count: null, note: "", target: "" },
  runs: [], // run history (appended by the runner)
});

export let state = store.loadState() ?? fresh();
state.runs = store.listRuns();
if (!state.snapshotId) state.snapshotId = null;
if (!state.preview) state.preview = { active: false, count: null, note: "", target: "" };
const persist = () => store.saveState(state);
persist();

export const reset = () => {
  store.clearRuns();
  state = fresh();
  persist();
  store.audit("demo.reset");
  return state;
};

export const toggleInterfaceChange = () => {
  state.submitLabel = state.submitLabel === "Submit" ? "Send Report" : "Submit";
  persist();
  store.audit("sandbox.interface_changed", { submitLabel: state.submitLabel });
  return state.submitLabel;
};

export const takeSnapshot = () => {
  state.snapshot = { ...state.report };
  const record = store.saveSnapshot({ report: state.snapshot, createdAt: new Date().toISOString() });
  state.snapshotId = record.id;
  persist();
  store.audit("run.snapshot_created", { snapshotId: record.id, report: state.snapshot });
  return state.snapshot;
};

export const saveReport = ({ count, note }) => {
  const parsedCount = Number(count);
  if (!Number.isInteger(parsedCount) || parsedCount < 0 || parsedCount > state.students.length) throw new Error("Present count must be a whole number within the class size.");
  state.report = { count: parsedCount, note: String(note ?? "").slice(0, 500), status: "Submitted" };
  persist();
  store.audit("report.submitted", { report: state.report });
  return state.report;
};

// Real undo: restores the report to the snapshot taken before the run.
export const undo = () => {
  if (!state.snapshot) return null;
  state.report = { ...state.snapshot };
  store.markSnapshotUndone(state.snapshotId);
  store.audit("run.undo", { snapshotId: state.snapshotId, report: state.report });
  state.snapshot = null;
  state.snapshotId = null;
  persist();
  return state.report;
};

export const appendRun = (run) => {
  const saved = store.saveRun(run);
  state.runs.unshift(saved);
  persist();
  return saved;
};

export const setRunPreview = (preview) => {
  state.preview = { ...state.preview, ...preview, updatedAt: new Date().toISOString() };
  persist();
  return state.preview;
};
