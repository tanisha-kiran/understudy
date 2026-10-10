# The Understudy

The Understudy is a demonstration-to-automation agent: teach it a browser task once, review the plain-English Skill Card it creates, and let it repeat the workflow with visible steps and human approval.

## What The Understudy is

The Understudy is a demonstration-to-automation agent. You teach it a browser workflow by doing the task once. It observes the actions, turns them into a plain-English Skill Card, and lets you edit and approve that card. Later, the card can guide the same workflow with visible progress and a human in control of the final action.

The name describes the role: an understudy watches how a task is done, learns the repeatable process, and is ready to take a turn when asked. Instead of asking people to write code or configure a complicated workflow builder, the product starts with the work they already know how to do.

## Why we are building it

Many useful tasks are repetitive but too small or inconsistent to justify a custom integration: copying a total between pages, updating a report, organizing an intake form, or transferring information between internal tools. People repeat these steps manually, which costs time and makes mistakes more likely. Traditional automation often requires technical setup and can break when a website changes. A general-purpose agent can be flexible, but acting without clear limits or review can be difficult to trust.

The Understudy explores a more understandable middle ground: teach by demonstration, make the learned procedure visible and editable, and require review before actions that change data. The user can see what the agent learned, what values it plans to use, what it is doing, and whether the result matches the expected outcome. That makes automation easier to inspect, correct, and trust.

## How it works

1. **Teach:** start a recording and perform a task in the demo browser. The recorder captures browser actions, page labels, selectors, values, timestamps, and screenshots. Optional narration can explain the intent behind an action.
2. **Describe:** the compiler turns the recording into a Skill Card: a title, trigger, changeable parameters, ordered plain-English steps, target descriptions, and a success check. The card is a readable recipe, not a hidden prompt.
3. **Review:** edit the steps and values, inspect confidence indicators, and approve the card. The app will not run an unapproved card.
4. **Run with oversight:** the runner snapshots the current data, shows a live timeline and target preview, and stops for approval before the final submission. A user can pause or stop a run.
5. **Verify and recover:** the app checks the expected result, shows a before-and-after diff, records the run in history and the audit log, and provides Undo using the saved snapshot.
6. **React to events:** a local event adapter and the support-ticket webhook inbox demonstrate how a new event could start an approved workflow. Event-triggered runs still respect the approval gate.

## The demo and its current scope

The main example transfers today's present-student count from **AttendanceTracker** into **DailyReport**. The app also includes a support-ticket webhook inbox that normalizes and displays incoming ticket events in real time. Together, these examples show both a taught browser workflow and an event-driven input.

This is a prototype, so the attendance tracker and report form are fake sandbox applications. The ticket inbox receives and displays ticket event data, but it does not connect to a real helpdesk, change tickets, or reply to customers. The browser runner is intentionally limited to the supported local demo workflow and allowed local origin. Agents API computer use, MCP Events delivery, and a native plugin sidebar are represented by adapters or mocks; they are not live integrations in this build.

## Why approval, snapshots, and audit matter

Automation should be understandable before it changes something important. Understudy keeps the Skill Card editable, requires explicit approval before a card can run, and pauses the first run before the final submission so the user can inspect the proposed result. The user remains able to pause or stop a run while it is active.

Each run takes a snapshot before acting. The before-and-after view helps the user see what changed, while the success check confirms whether the expected result appeared. Undo restores the saved pre-run state in the demo. The audit trail records decisions and outcomes so the demo can explain what happened. These protections are core parts of the product idea: they make it possible to delegate routine work while preserving review, accountability, and a path to recovery.

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
- **Live data intake:** the dashboard now includes a generic support-ticket webhook inbox. `POST /api/integrations/tickets/webhook` normalizes common ticket payloads, deduplicates by event ID, persists the event in SQLite, and streams it to the dashboard over SSE. It deliberately does not update the helpdesk or reply to a customer. It stores ticket ID, title, priority, status, source, and event timestamps; it drops requester fields and ticket body text. The **Send sample ticket** button exercises the same adapter locally.
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
- Generic helpdesk ticket intake: `POST /api/integrations/tickets/webhook` with `{ "event_id": "evt-123", "ticket": { "id": "T-123", "subject": "Export is failing", "priority": "high", "status": "open" } }`
- Live ticket feed: `GET /api/integrations/tickets/events` (Server-Sent Events); current inbox: `GET /api/integrations/tickets`

The ticket endpoint is loopback-only by default. For a reachable service, set a long random `UNDERSTUDY_WEBHOOK_SECRET` in the server's `.env` and send it as `x-understudy-secret`; set `x-understudy-source` to identify the sender. The application must also be deployed behind a properly secured HTTPS endpoint before a third-party helpdesk can deliver events. Configure the helpdesk's webhook to send the normalized JSON shape above (or add a provider-specific mapping adapter). This local prototype has no helpdesk credentials, ticket read API, outbound ticket updates, or production user authentication.

Skill Cards can also be exported as JSON and imported into another local demo. Imported cards get a new ID and lose any previous approval so the recipient must review and approve them.

The recorder captures event values, but this local compiler only uses a simple one-example heuristic for parameters. It does not yet compare two recordings to reliably distinguish constants from changing values; that remains a stretch item.
