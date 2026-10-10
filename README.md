# The Understudy

Teach a local workflow once, review the Skill Card, approve it, then watch an approval-gated run prepare a report. This hackathon build is deliberately scoped to two fake web apps: **AttendanceTracker** and **DailyReport**.

## Start the demo

Use Node.js 22 or newer.

```sh
npm install
npm run demo
```

`npm run demo` starts the API and dashboard, resets the demo data, and prints the dashboard URL. Open [http://localhost:5173](http://localhost:5173). If the default ports are occupied, Vite may select the next available port; its terminal output shows the correct URL. Stop the demo with Ctrl+C.

For separate terminals, use `npm run dev` and reset with the **Reset demo** button. To enable model-backed Skill Card compilation, copy `.env.example` to `.env`, set `OPENAI_API_KEY`, and optionally set `OPENAI_MODEL`. The key stays on the server. The default model is `gpt-4o-mini`; without a key or if compilation fails, the app labels and uses its deterministic compiler.

## Demo flow

1. Select **Teach a new skill**, then **Start live recording**. A separate Playwright-controlled Chrome window opens on AttendanceTracker. Perform the copy-to-report workflow in the two sandbox pages. The recorder captures page navigation, clicks, text entry, selectors, visible labels, values, timestamps, and a screenshot for each recorded step.
2. Optionally add timestamped text narration or use browser speech recognition when available. Stop the recording to compile a Skill Card. Guided description remains available if browser recording cannot start.
3. Review and edit the Skill Card. It shows its parameters, allowed local domain, ordered instructions, and confidence per step. Save edits and explicitly approve the card before using the dry-run preview. Changing an approved card requires approval again.
4. The first run of each card prepares the report, shows the live target preview, and stops before Submit. Review the values and approve the final submission. Later runs keep the same final-submit approval gate.
5. The demo can rename **Submit** to **Send Report** while the run waits. After approval, the runner records the failed original target, finds the single known report-submit button, retries, and records the repair.
6. Inspect the verification and before/after diff, then choose **Undo last run**. The run history includes trigger, duration, repairs, and outcome. **Simulate event** and the local webhook can start only an approved card; they still stop for final submission approval.

## What is real and what is mocked

- **Real locally:** Playwright recording and visible browser control; per-step screenshots; editable/schema-validated Skill Cards; optional OpenAI compilation; Playwright execution against the local pages; bounded Submit-to-Send Report recovery; live SSE run timeline; a mirrored report preview with ghost cursor; approval, pause, stop, verification, snapshots, undo, and append-only audit entries; SQLite persistence for state, skills, runs, snapshots, recordings, and audit log.
- **Local adapter:** `POST /api/webhook` and the **Simulate event** control. With no `UNDERSTUDY_WEBHOOK_SECRET`, the webhook accepts loopback requests only. Set the secret and send it in `x-understudy-secret` for authenticated non-loopback delivery; public deployment still needs a reachable HTTPS endpoint.
- **Mocked / not connected:** Agents API computer use, MCP Events delivery, and a native ChatGPT plugin sidebar/conversation panel. The standalone React dashboard is the demo panel. MCP Events and plugin integration require deployment and account registration; the hosted Agents API browser does not automatically share this laptop's localhost sandbox.
- The runner only executes the fixed AttendanceTracker-to-DailyReport workflow on `localhost:8787`. Skill step text is reviewable and editable, but it cannot expand the runner's supported actions or domain scope. The recorder blocks browser requests outside the local demo origin.
- Voice narration depends on browser speech-recognition support; timestamped typed narration is always available.

Data lives in `data/understudy.sqlite`; recordings and screenshots are saved under `data/recordings/`. `npm run demo` resets sandbox state and run history but keeps compiled skill cards and the append-only audit trail. These generated files are ignored by Git.

## Checks

```sh
npm run build
npm run smoke
```

The smoke scenario exercises recording startup, card approval, first-run preview gate, pause/resume, the controlled button rename and repair, report verification, audit persistence, undo, and reset. It uses the installed stable Chrome when available, then Playwright Chromium. Install Chromium with `npx playwright install chromium` if neither is available.

## URLs

- Dashboard: `http://localhost:5173`
- AttendanceTracker: `http://localhost:8787/sandbox/attendance`
- DailyReport: `http://localhost:8787/sandbox/report`
- Health/audit adapter info: `GET /api/audit`
- Run event stream: `GET /api/run/events`
- Local event webhook: `POST /api/webhook` with `{ "skillId": "...", "event": "..." }`

Skill Cards can also be exported as JSON and imported into another local demo. Imported cards get a new ID and lose any previous approval so the recipient must review and approve them.

The recorder captures event values, but this local compiler only uses a simple one-example heuristic for parameters. It does not yet compare two recordings to reliably distinguish constants from changing values; that remains a stretch item.
