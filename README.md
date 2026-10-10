# The Understudy

The Understudy is a demonstration-to-automation agent: teach it a browser task once, review the plain-English Skill Card it creates, and let it repeat the workflow with visible steps and human approval.

## What it does and why it matters

People often repeat the same small browser tasks across forms, spreadsheets, and internal tools. Recreating each one as a brittle script takes time and breaks when a page changes. The Understudy explores a more teachable approach: show the task once, let the agent turn it into steps you can edit, then keep a person in control of every consequential action.

The demo copies today's present-student count from **AttendanceTracker** into **DailyReport**. It records the teaching session, creates a Skill Card, previews the report before submitting, asks for approval, verifies the saved result, records an audit trail, and offers Undo. A support-ticket webhook inbox also shows incoming ticket events in real time. This prototype is intentionally limited to fake attendance/report apps and ticket-event intake; it does not yet connect to a real helpdesk or take actions on ticket data.

## Hosting on Vercel

**Important:** this repository is not yet deployable as a fully working app on Vercel. Vercel can host the Vite frontend, but the current project also needs a long-running Express server, local SQLite storage, and a visible Playwright browser for Teach mode. Vercel's Vite deployment serves the built `dist` frontend; it does not start this repository's `server/index.mjs`. Vercel documents its backend as request-scoped Functions, and its guidance says local SQLite files are not persistent/shared in that environment. See [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [SQLite support on Vercel](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel), and [Vercel Function limits](https://vercel.com/docs/functions/limitations).

### Deploy a frontend preview

These settings will put the visual dashboard online, but its `/api/*` features will not work until the backend is adapted or separately hosted and connected:

1. In Vercel, choose **Add New → Project** and import `tanisha-kiran/understudy` from GitHub.
2. Set the project root to the repository root and choose the **Vite** framework preset.
3. Set **Build Command** to `npm run build` and **Output Directory** to `dist` (the `build` script runs TypeScript checking and Vite).
4. Deploy. The resulting URL serves the frontend preview only; buttons that need `/api` or `/sandbox` will not work yet.

### What must change for a fully working Vercel deployment

Before using the deployed dashboard as the real app, complete these deployment tasks:

1. Move the Express routes into Vercel Functions (or host the Express API on a separate Node service and route requests from the frontend to it).
2. Replace the local SQLite file with a managed database such as a Vercel Marketplace Postgres provider. Vercel's storage integrations provide managed databases through project environment variables; see [Vercel Storage](https://vercel.com/docs/storage).
3. Keep the visible teaching browser in a local/remote browser worker. The current recorder opens Chrome on the computer running the server, so it cannot open a window on your laptop from a Vercel deployment. The automation runner also needs a suitable hosted browser and its allowed-domain/security setup.
4. Replace the long-lived local event streams with a hosted realtime service or polling. Vercel Functions have a maximum request duration, so they cannot keep this app's current SSE connections open indefinitely.
5. Add dashboard authentication and configure production webhook secrets before exposing real ticket data. The current local demo has no user login.

If you host the API on a separate service and later make that backend deployment-ready, Vercel can proxy the dashboard's API and sandbox requests using external rewrites. Replace the example hostname with your backend's HTTPS domain in `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://YOUR-BACKEND.example.com/api/:path*" },
    { "source": "/sandbox/:path*", "destination": "https://YOUR-BACKEND.example.com/sandbox/:path*" }
  ]
}
```

This rewrite only connects the frontend to an API host; it does not make the current SQLite store or local-browser recorder work on Vercel. See [Vercel external rewrites](https://vercel.com/docs/routing/rewrites).

For now, use **Local demo** below for the complete working experience. Do not add production ticket or customer data to the frontend-only Vercel preview.

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
