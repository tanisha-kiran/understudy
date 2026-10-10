# OpenAI and Codex capability notes

Checked against official documentation on **October 10, 2026**. These notes separate documented product capabilities from access this particular project/account has not yet established.

## What is available

### Agents API: computer use, tools, and delegation

- The Agents API provides a managed Codex harness with sessions, tools, environments, streaming events, and session lifecycle management. It is a cloud API that requires an OpenAI API key and an API project with access; availability, model access, and API billing are separate from this local demo.
- Its computer-use tool operates in an **OpenAI-hosted browser**. The application creates a session, streams events, handles website-origin approval requests, checks the result, and cleans up the session. Screenshots can be included for a live activity view.
- The hosted browser does not automatically share this laptop's browser or reach a dev server bound to `localhost`. The local demo therefore keeps Playwright as its working browser adapter. A live Agents API adapter can only be enabled after choosing and configuring a reachable/self-hosted environment, API credentials, and origin approvals.
- Tools can also be exposed as function calls or connected through MCP. Multi-agent mode can delegate independent work to subagents, but it adds coordination and usage overhead; it is not needed for this single deterministic demo.

Sources: [Agents API computer use](https://developers.openai.com/api/docs/guides/agents-api/tools/computer-use), [Agents API overview](https://developers.openai.com/api/docs/guides/agents-api/overview), [Multi-agent](https://developers.openai.com/api/docs/guides/agents-api/multi-agent), [Events and items](https://developers.openai.com/api/docs/guides/agents-api/sessions/events).

### Plugin extensions: sidebar, conversation panels, and file viewers

- MCP Extensions document sidebar apps, conversation panels, settings, file viewers/editors, display modes, deep links, and other ChatGPT surfaces.
- These are **ChatGPT plugin surfaces**, not automatically available to an arbitrary local React app. They require an MCP server, extension metadata/resources, a connected plugin, and the relevant ChatGPT surface/account availability.
- For this hackathon, the current standalone React dashboard remains the reliable panel adapter. A native ChatGPT panel is an integration target behind the same panel entrypoint, not a prerequisite for the demo.

Source: [Plugin Extensions](https://developers.openai.com/plugins/build/extensions).

### MCP Events

- MCP Events are real, but they are not a generic browser `EventSource` subscription. ChatGPT's integration uses MCP 2.0 event methods (`events/list`, `events/subscribe`, `events/unsubscribe`) and **signed webhook delivery**.
- The official guide scopes availability to ChatGPT Work on web, ChatGPT desktop with Cloud selected, and dots; it requires protocol version `2026-07-28`, persistent subscription storage, and outbound HTTPS callback delivery. The guide says polling and streaming delivery are not supported by this integration.
- A local development server is not a public HTTPS callback. The demo will use the same `TriggerAdapter` contract with a local webhook/simulate-event adapter. A live MCP Events adapter stays disabled until the server is registered/deployed with durable subscriptions and a reachable callback.

Source: [MCP Events](https://developers.openai.com/plugins/build/mcp-events).

### Codex CLI

- Codex CLI is a local coding agent: it can inspect/edit/run a repository under configured permissions and can be invoked interactively or through `codex exec` in scripts/CI.
- It is not a public runtime SDK for embedding a browser agent into The Understudy. The app will not shell out to Codex CLI as its execution engine. CLI usage is a developer workflow only.

Source: [Codex CLI](https://learn.chatgpt.com/docs/codex/cli).

## Adapter decisions for the demo

| Capability | Real path | Demo fallback / boundary |
|---|---|---|
| Recording | Local Playwright page instrumentation records navigation, click, text input, select changes, selector, visible label/value, time, and screenshot. | If recording is unavailable, preserve an explicitly labeled guided-teach flow. Narration may be timestamped text; voice transcription is optional and must have a text fallback. |
| Skill compilation | Server-side OpenAI structured output, then schema validation and allowlist validation. | Deterministic compiler emits the same card schema and is labeled as a fallback. |
| Browser execution | Local Playwright is the demo's real, deterministic browser adapter. Agents API computer use is a separate optional adapter for an eligible hosted/self-hosted environment. | Replay only supported actions on the two sandbox origins; no arbitrary URL, selector, or domain expansion. |
| Recovery | Agents API could reason over screenshots/tool results where configured; local adapter can try a bounded, evidence-based accessible-name recovery. | The deliberate Submit → Send Report case is the only promised deterministic repair. Log the failed original locator before attempting recovery. |
| Triggers | Registered MCP Events over signed HTTPS webhooks when deployment and ChatGPT Work access exist. | Local webhook endpoint plus Simulate event button behind `TriggerAdapter`; visibly identify it as local/mock delivery. |
| Panel | MCP Extension entrypoint when a plugin is connected and supported by the user's ChatGPT surface. | The current React dashboard is the standalone panel with matching views and is the hackathon presentation surface. |
| Store | SQLite implementation behind `StoreAdapter` for skills, runs, snapshots, and audit entries. | Memory store behind the same interface only if SQLite setup is a runtime/build blocker; disclose that storage is volatile. |

**Trust boundary:** an approved card still cannot access a domain outside its explicit allowlist. Every run snapshots first, the first run is a dry run that stops before the final submit, and any actual final submit waits for an explicit user approval. The execution log records trigger source, actions, repairs, outcome, and undo verification.

## Current prototype implementation status

The local build now implements the recorder, standalone panel, SQLite store, local webhook/simulated-event trigger, and approval-gated Playwright execution described above. The API-based Agents computer-use runtime, MCP Events delivery, and registered ChatGPT plugin surfaces remain unconnected adapters. Their required access and deployment conditions are unchanged. Run `npm run demo` for a reset rehearsal and see `README.md` for current behavior and limits.
