# The Understudy — build plan and completion status

## Goal

Deliver a rehearsable local **teach → review → approve → execute → verify → undo** demo. Production-connected ChatGPT plugin and MCP Events deployment are out of this local hackathon scope because they need account registration and a public HTTPS callback; their boundaries are documented in `docs-notes.md`.

## Milestones

| Milestone | Status | Delivered |
|---|---|---|
| Capability research | Complete | Official OpenAI docs summarized in `docs-notes.md`; real vs unavailable integrations called out. |
| Sandbox and baseline runner | Complete | AttendanceTracker and DailyReport; DOM count; report fill; explicit final-submit approval; verification; snapshot and undo; controlled button recovery. |
| Teach recorder | Complete | Playwright opens an isolated Chrome window restricted to the local demo origin; records navigation, clicks, inputs, selectors, values, timestamps, and a screenshot per step. Typed narration always works; browser speech recognition is optional. |
| Skill Card compiler | Complete | OpenAI structured output when configured; validated deterministic fallback; changing values can become parameter chips; card instructions and confidence are editable. |
| Runner and safety | Complete | Fixed local task adapter, per-card first-run preview gate, approved-card check, final-submit approval on every run, pause/stop, snapshot, verification, bounded known recovery, append-only run audit. |
| Panel | Complete | Standalone React dashboard, live recording list, editable Skill Card, confidence meters, SSE timeline, live target preview with ghost cursor, result diff/undo, history. |
| Trigger and storage | Complete | Simulated local event and loopback/authenticated webhook adapter; SQLite for state, skills, runs, snapshots, recordings, and audit log. |
| Demo handoff | Complete | `npm run demo` resets and starts the local demo; README documents setup, rehearsal, APIs, and integration boundaries. Build and smoke scenario pass. |

## Adapter boundaries

- **Recorder:** real local Playwright browser. Guided description is the fallback.
- **Compiler:** optional OpenAI API; deterministic validated compiler is the fallback. The API model setting is independent of the model used by Codex to help build this project.
- **Runner:** real local Playwright, fixed to `localhost:8787` and the attendance/report pages. Agents API computer use is not connected to the laptop browser.
- **Trigger:** local webhook and Simulate event control work. MCP Events delivery is not connected.
- **Panel:** standalone React works. Native ChatGPT sidebar/conversation/file panels are not connected.
- **Store:** SQLite is implemented with Node 22's built-in `node:sqlite`; there is no volatile in-memory fallback in this build.

## Demo definition of done

A cold start through `npm run demo` opens the dashboard and resets sandbox state. The rehearsal can capture the task, inspect/edit and approve the card, preview a first run, explicitly authorize the final submission, demonstrate the Submit → Send Report repair, verify the saved report, inspect the diff, undo, and inspect history/audit records. `npm run build` and `npm run smoke` are the checks for the local demo.
