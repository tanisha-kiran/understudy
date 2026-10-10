# Build status and remaining boundaries

## Completed local demo milestones

- Sandbox baseline and adapter boundaries.
- Playwright browser recorder with per-event screenshots and timestamped narration; guided description fallback.
- Structured Skill Card compiler with parameters, confidence, selector fallback text, and domain validation. OpenAI compilation is optional; deterministic local compilation works without credentials.
- Approval-gated Playwright runner with per-card first-run preview, run snapshots, explicit final-submit approval, pause/stop, bounded repair, verification, and undo.
- Standalone React panel with live recording steps, editable card, confidence, SSE timeline, mirrored target preview and ghost cursor, diff, and run history.
- SQLite-backed skills, runs, snapshots, recordings, state, and audit log; local webhook and simulated-event adapters.
- One-command demo start/reset, README, production build, smoke scenario, and JSON Skill Card export/import.

## Explicitly mocked integrations

Agents API computer use is not connected to the local Chrome process. MCP Events and native ChatGPT extension panels are represented by adapter boundaries only; this build uses the standalone dashboard and local webhook/simulate-event trigger. Live service integration requires account access, registration, and public deployment details documented in `docs-notes.md`.

## Demo handoff

```sh
npm install
npm run demo
```

Open the printed dashboard address, choose **Teach a new skill**, record the attendance-to-report workflow, review and approve its card, preview the first run, confirm submission, then inspect the recovery, diff, and undo.
