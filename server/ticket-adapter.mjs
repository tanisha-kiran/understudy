import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { store } from "./store.mjs";

const updates = new EventEmitter();
updates.setMaxListeners(100);

const text = (value, max = 240) => typeof value === "string" ? value.trim().slice(0, max) : "";

/** Normalize common webhook shapes while retaining only fields needed for triage. */
export function normalizeTicketEvent(payload = {}, source = "generic-webhook") {
  const root = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const data = root.ticket ?? root.data?.ticket ?? root.data ?? root;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Webhook must contain a ticket object.");
  const ticketId = text(String(data.id ?? data.ticket_id ?? data.key ?? ""), 120);
  const title = text(data.subject ?? data.title ?? data.summary ?? "", 240);
  if (!ticketId || !title) throw new Error("Ticket id and subject/title are required.");

  const priorityValue = text(String(data.priority ?? "normal"), 24).toLowerCase();
  const priority = ["low", "normal", "medium", "high", "urgent"].includes(priorityValue) ? priorityValue : "normal";
  const eventId = text(String(root.event_id ?? root.webhook_id ?? root.id ?? ""), 180) || randomUUID();
  const occurredAt = text(String(root.occurred_at ?? root.timestamp ?? data.updated_at ?? ""), 40);
  return {
    eventId,
    ticketId,
    title,
    priority,
    status: text(String(data.status ?? "new"), 40) || "new",
    source: text(source, 80) || "generic-webhook",
    receivedAt: new Date().toISOString(),
    occurredAt: occurredAt || null,
    deduplicated: false,
  };
}

export const ticketAdapter = {
  kind: "generic-helpdesk-webhook",
  list: () => store.listTicketEvents(),
  ingest(payload, source) {
    const event = normalizeTicketEvent(payload, source);
    const existed = Boolean(store.getTicketEvent(event.eventId));
    const saved = store.saveTicketEvent(event);
    if (!existed) {
      store.audit("ticket.event_received", { eventId: saved.eventId, ticketId: saved.ticketId, source: saved.source, priority: saved.priority });
      updates.emit("ticket", saved);
    }
    return { event: { ...saved, deduplicated: existed }, deduplicated: existed };
  },
  subscribe(listener) { updates.on("ticket", listener); return () => updates.off("ticket", listener); },
};

