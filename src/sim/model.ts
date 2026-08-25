/**
 * Simulation engine: pure state-mutation functions (accept/reject/cancel/
 * refund/resend/escalate/etc.) plus the "what should this order's derived
 * state be" logic (deriveOrderState, applyNeed, setOrderStage). None of this
 * touches React — SimulationProvider is the only consumer, and calls these
 * functions against a cloned snapshot on every action so undo/redo and the
 * playback controls stay simple. ActionKind (near the bottom of this file)
 * is the single source of truth for which action sheets exist in the UI.
 */
import {
  COLLECTORS,
  LANDING_ZONES,
  ORDERS,
  STAGES,
  STORES,
  needsSplit,
  parseKg,
  type ActivityLogIcon,
  type Collector,
  type Interaction,
  type LocationScope,
  type Order,
  type Store,
} from "@/data"

// ---- Supervisor messages (moved out of messages-sheet) ----

export type Message = {
  id: string
  from: string
  initials: string
  subject: string
  preview: string
  time: string
  unread?: boolean
}

export const MESSAGES: Message[] = [
  {
    id: "m1",
    from: "Aoife Nolan",
    initials: "AN",
    subject: "Weather hold — Balbriggan cell",
    preview:
      "Winds gusting 45km/h. Keep auto-dispatch paused until I give the all-clear.",
    time: "2m",
    unread: true,
  },
  {
    id: "m2",
    from: "Ops control",
    initials: "OC",
    subject: "Collector shortfall 18:00–20:00",
    preview:
      "We're two collectors short for the dinner peak. Prioritise Blanchardstown runs.",
    time: "24m",
    unread: true,
  },
  {
    id: "m3",
    from: "Diarmuid Walsh",
    initials: "DW",
    subject: "Re: Order #0104 refund",
    preview:
      "Approved the goodwill credit. Let the customer know it's on the way.",
    time: "1h",
  },
  {
    id: "m4",
    from: "Ops control",
    initials: "OC",
    subject: "Riverwood zone reopened",
    preview:
      "Landing zone inspection complete — you're clear to resume deliveries.",
    time: "3h",
  },
]

// ---- Nav alerts ----

export type AlertKey = "collectors" | "messages" | "vendors"
export type Alerts = Record<AlertKey, string | null>

// ---- System status ----

export type SystemKind =
  | "none"
  | "weather"
  | "airspace"
  | "high-demand"
  | "degraded"

export const SYSTEM_PRESETS: Record<
  Exclude<SystemKind, "none">,
  { tone: "warning" | "critical" | "info"; message: string; actionLabel: string }
> = {
  weather: {
    tone: "warning",
    message:
      "Weather hold in effect — high winds have grounded drones and paused auto-dispatch.",
    actionLabel: "Review affected orders",
  },
  airspace: {
    tone: "critical",
    message:
      "Airspace restriction active — routes crossing the temporary NOTAM need manual review.",
    actionLabel: "Review affected orders",
  },
  "high-demand": {
    tone: "info",
    message:
      "High demand — order volume is above capacity. New orders may queue for acceptance.",
    actionLabel: "Review the queue",
  },
  degraded: {
    tone: "critical",
    message:
      "System degraded — autopilot dispatch is temporarily unavailable. Handle orders manually.",
    actionLabel: "Review affected orders",
  },
}

export const SYSTEM_LABELS: Record<SystemKind, string> = {
  none: "All clear",
  weather: "Weather hold",
  airspace: "Airspace restriction",
  "high-demand": "High demand",
  degraded: "System degraded",
}

// ---- Snapshot ----

export type SimSnapshot = {
  orders: Order[]
  collectors: Collector[]
  stores: Store[]
  messages: Message[]
  systemKind: SystemKind
  scope: LocationScope
}

// ---- Order lifecycle state machine ----

export type NeedKind =
  | "none"
  | "accept"
  | "route-restricted"
  | "spot-rejected"
  | "aborted-remade"

export const NEED_LABELS: Record<NeedKind, string> = {
  none: "No action needed",
  accept: "Awaiting acceptance",
  "route-restricted": "Route needs confirming",
  "spot-rejected": "Delivery spot rejected",
  "aborted-remade": "Aborted & remade",
}

export function clone<T>(value: T): T {
  return structuredClone(value)
}

function nowHM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`
}

function activeVersion(o: Order) {
  const groups = o.payloads
  if (!groups || !groups.length) return null
  const g = groups[0]
  return g.versions[g.versions.length - 1] ?? null
}

/** Whether a collector is currently attached to the order's active payload. */
function orderHasCollector(o: Order): boolean {
  const v = activeVersion(o)
  if (v) return !!v.collector
  return !!o.collector
}

/**
 * Recompute group / badge / eta for an order that has no pending `needs`.
 * Activity strings mirror the ones shown on the production order card
 * (e.g. "Waiting for collector", "Received", "In flight").
 */
export function deriveOrderState(o: Order): void {
  if (o.cancelled) {
    o.group = "done"
    o.badge = { cls: "warn", text: "Cancelled" }
    o.eta = o.refunded ? "Cancelled · refunded" : "Cancelled"
    return
  }
  if (o.needs) {
    o.group = "attention"
    return
  }
  const hasCol = orderHasCollector(o)
  switch (o.statusIdx) {
    case 6:
      o.group = "done"
      o.badge = { cls: "done", text: "Delivered" }
      if (!o.eta.startsWith("Delivered")) o.eta = `Delivered ${nowHM()}`
      break
    case 5:
      o.group = "flight"
      o.badge = { cls: "flight", text: "In flight" }
      if (!o.eta.startsWith("ETA")) o.eta = "ETA 8 min"
      break
    case 4:
      o.group = "flight"
      o.badge = { cls: "auto", text: "Ready" }
      if (!o.eta.startsWith("ETA")) o.eta = "ETA 12 min"
      break
    case 3:
      o.group = "flight"
      o.badge = { cls: "auto", text: "Received" }
      if (!o.eta.startsWith("ETA")) o.eta = "ETA 16 min"
      break
    case 2:
      o.group = "flight"
      o.badge = hasCol
        ? { cls: "auto", text: "Collector assigned" }
        : { cls: "auto", text: "Waiting for collector" }
      if (!o.eta.startsWith("ETA")) o.eta = "ETA 22 min"
      break
    case 1:
      o.group = "flight"
      o.badge = { cls: "auto", text: "Manna accepted" }
      if (!o.eta.startsWith("ETA")) o.eta = "ETA 26 min"
      break
    default:
      if (o.autopilot) {
        o.group = "flight"
        o.badge = { cls: "auto", text: "New order" }
        o.eta = "New"
      } else {
        o.group = "attention"
        o.badge = { cls: "action", text: "Accept order" }
        o.eta = "New"
      }
  }
}

/** Rebuild the timeline to match the current statusIdx. */
function syncTimeline(o: Order): void {
  const upTo = Math.min(o.statusIdx, STAGES.length - 1)
  const existing = o.timeline
  const next: Order["timeline"] = []
  for (let i = 0; i <= upTo; i++) {
    const prior = existing[i]
    next.push({
      k: STAGES[i].key,
      t: prior?.t ?? nowHM(),
      auto: true,
    })
  }
  o.timeline = next
}

export function advanceOrder(o: Order): void {
  if (o.statusIdx >= STAGES.length - 1) return
  o.statusIdx += 1
  const v = activeVersion(o)
  if (v && v.statusIdx < STAGES.length - 1) v.statusIdx += 1
  syncTimeline(o)
  deriveOrderState(o)
}

export function regressOrder(o: Order): void {
  if (o.statusIdx <= 0) return
  o.statusIdx -= 1
  const v = activeVersion(o)
  if (v && v.statusIdx > 0) v.statusIdx -= 1
  syncTimeline(o)
  deriveOrderState(o)
}

export function setOrderStage(o: Order, idx: number): void {
  o.statusIdx = Math.max(0, Math.min(idx, STAGES.length - 1))
  const v = activeVersion(o)
  if (v) v.statusIdx = o.statusIdx
  syncTimeline(o)
  deriveOrderState(o)
}

export function toggleAutopilot(o: Order): void {
  o.autopilot = !o.autopilot
  deriveOrderState(o)
}

/** Apply (or clear) an "unhappy path" need on an order. */
export function applyNeed(o: Order, kind: NeedKind): void {
  switch (kind) {
    case "none":
      delete o.needs
      deriveOrderState(o)
      return
    case "accept":
      o.statusIdx = 0
      o.autopilot = false
      o.badge = { cls: "action", text: "Accept order" }
      o.eta = "New"
      o.needs = {
        title: "New order awaiting acceptance",
        body: "Orders like this are usually accepted in the background, but this one was held for a manual decision.",
        cta: "Accept now",
      }
      break
    case "route-restricted":
      o.badge = { cls: "action", text: "Confirm route" }
      o.needs = {
        title: "Route needs confirming",
        body: "The generated route crosses a temporary airspace restriction. Confirming routes isn’t available from here — escalate so a supervisor can review and reserve it.",
        restricted: true,
      }
      break
    case "spot-rejected":
      o.badge = { cls: "action", text: "Needs delivery spot" }
      o.needs = {
        title: "Delivery spot rejected",
        body: "The drop point failed an obstacle check. Update the delivery spot, or message the customer to clear the current one.",
        cta: "Change delivery spot",
        allowMessage: true,
      }
      break
    case "aborted-remade": {
      if (!o.payloads || !o.payloads.length) {
        o.payloads = [
          {
            letter: "A",
            contents: o.items[0]?.n ?? "Payload",
            versions: [
              {
                weight: o.weight ?? "1.0 kg",
                bags: o.bags ?? 1,
                statusIdx: o.statusIdx,
                drone: "MNA-114",
                collector: o.collector ?? null,
              },
            ],
          },
        ]
      }
      const g = o.payloads[0]
      const last = g.versions[g.versions.length - 1]
      last.superseded = true
      last.badge = "Aborted"
      last.outcome =
        "Aborted mid-flight — drone returned to base. Reset & remade."
      g.versions.push({
        weight: last.weight,
        bags: last.bags,
        statusIdx: 4,
        drone: "MNA-127",
        collector: null,
        eta: "Awaiting route",
        blocked: true,
      })
      o.badge = { cls: "action", text: "Confirm route" }
      o.needs = {
        title: "Route needs confirming",
        body: "The remade payload has a route that crosses a temporary airspace restriction. Escalate so a supervisor can review and reserve it.",
        restricted: true,
      }
      break
    }
  }
  o.group = "attention"
}

// ---- User action flows ----

export type ActionKind =
  | "accept"
  | "confirm-spot"
  | "escalate"
  | "cancel"
  | "refund"
  | "resend"
  | "remake"
  | "message"
  | "note"
  | "edit-address"

/** Prepend an entry to the order's interaction log. */
export function pushInteraction(
  o: Order,
  type: Interaction["type"],
  text: string,
  who = "You"
): void {
  o.intx = [{ type, who, text, when: "just now" }, ...o.intx]
}

/** Record an operator-executed action so it shows in past activity. */
export function logActivity(
  o: Order,
  icon: ActivityLogIcon,
  label: string
): void {
  o.log = [{ icon, label, when: nowHM() }, ...(o.log ?? [])]
}

export function acceptOrder(o: Order, etaMin: number): void {
  delete o.needs
  o.autopilot = true
  if (o.statusIdx < 1) o.statusIdx = 1
  syncTimeline(o)
  deriveOrderState(o)
  pushInteraction(
    o,
    "sys",
    etaMin > 0
      ? `Order accepted with a +${etaMin} min kitchen ETA.`
      : "Order accepted."
  )
}

export function rejectOrder(o: Order, reason: string): void {
  o.cancelled = true
  o.refunded = true
  delete o.needs
  o.group = "done"
  o.badge = { cls: "warn", text: "Rejected" }
  o.eta = "Rejected · refunded"
  pushInteraction(
    o,
    "sys",
    `Order rejected (${reason}) — customer notified and refunded.`
  )
  logActivity(o, "rejected", `Rejected & refunded — ${reason}`)
}

export function suggestSpots(
  o: Order,
  count: number,
  unsuitableReason: string | null,
  note?: string | null
): void {
  delete o.needs
  o.cust.spot = "Suggestions sent · customer to pick"
  deriveOrderState(o)
  pushInteraction(
    o,
    "note",
    `Suggested ${count} delivery spot${count === 1 ? "" : "s"}${
      unsuitableReason ? ` · flagged unsuitable: ${unsuitableReason}` : ""
    }.${note ? ` Note: “${note}”.` : ""}`
  )
  pushInteraction(
    o,
    "msg",
    "Action needed for your order. Please open the app and select your preferred delivery spot."
  )
  logActivity(
    o,
    "spots",
    `Suggested ${count} delivery spot${count === 1 ? "" : "s"}${
      unsuitableReason ? ` · flagged unsuitable` : ""
    }`
  )
  if (o.statusIdx === 0) acceptOrder(o, 0)
}

export function escalateOrder(o: Order, note: string, priority: string): void {
  delete o.needs
  o.autopilot = true
  deriveOrderState(o)
  o.badge = { cls: "auto", text: "Escalated to supervisor" }
  pushInteraction(
    o,
    "sys",
    `Escalated to supervisor (${priority})${note ? ` — “${note}”` : ""}.`
  )
  logActivity(o, "escalated", `Escalated to supervisor · ${priority}`)
}

export function cancelOrder(o: Order, reason: string, refund: boolean): void {
  o.cancelled = true
  o.refunded = refund
  delete o.needs
  o.group = "done"
  o.badge = { cls: "warn", text: "Cancelled" }
  o.eta = refund ? "Cancelled · refunded" : "Cancelled"
  pushInteraction(
    o,
    "sys",
    `Order cancelled — ${reason}${refund ? " · full refund issued" : ""}.`
  )
  logActivity(
    o,
    "cancelled",
    `Cancelled — ${reason}${refund ? " · refunded" : ""}`
  )
}

export function refundOrder(o: Order, amount: string, reason: string): void {
  o.refunded = true
  pushInteraction(o, "sys", `Refund issued (${amount}) — ${reason}.`)
  logActivity(o, "refunded", `Refund issued ${amount} — ${reason}`)
}

export function remakePayload(o: Order): void {
  if (!o.payloads || !o.payloads.length) {
    o.payloads = [
      {
        letter: "A",
        contents: o.items[0]?.n ?? "Payload",
        versions: [
          {
            weight: o.weight ?? "1.0 kg",
            bags: o.bags ?? 1,
            statusIdx: o.statusIdx,
            drone: "MNA-114",
            collector: o.collector ?? null,
          },
        ],
      },
    ]
  }
  const g = o.payloads[0]
  const last = g.versions[g.versions.length - 1]
  last.superseded = true
  last.badge = "Remade"
  last.outcome =
    "Food remade — a fresh payload was created and sent back through the pipeline."
  g.versions.push({
    weight: last.weight,
    bags: last.bags,
    statusIdx: 2,
    drone: null,
    collector: null,
    collectorStatus: "WAITING_FOR_COLLECTOR_TO_ACCEPT",
  })
}

export function splitOverweight(o: Order): void {
  if (!needsSplit(o)) return
  const totalKg = parseKg(o.weight)
  const half = totalKg / 2
  const kg = (n: number) => `${n.toFixed(1)} kg`
  const totalBags = o.bags ?? 2
  const bagsA = Math.max(1, Math.ceil(totalBags / 2))
  const bagsB = Math.max(1, totalBags - bagsA)
  o.payloads = [
    {
      letter: "A",
      contents: o.items[0]?.n ?? "Payload A",
      versions: [
        {
          weight: kg(half),
          bags: bagsA,
          statusIdx: o.statusIdx,
          drone: null,
          collector: o.collector ?? null,
          collectorStatus: o.collectorStatus,
        },
      ],
    },
    {
      letter: "B",
      contents: o.items[1]?.n ?? "Payload B",
      versions: [
        {
          weight: kg(totalKg - half),
          bags: bagsB,
          statusIdx: o.statusIdx,
          drone: null,
          collector: null,
          collectorStatus: "WAITING_FOR_COLLECTOR_TO_ACCEPT",
        },
      ],
    },
  ]
}

export function resendOrder(
  o: Order,
  category: string,
  notes: string,
  remakeFood: boolean
): void {
  delete o.needs
  o.cancelled = false
  o.autopilot = true
  if (remakeFood) {
    remakePayload(o)
    o.statusIdx = 2
  } else {
    o.statusIdx = 3
  }
  syncTimeline(o)
  deriveOrderState(o)
  pushInteraction(
    o,
    "sys",
    `Reset & resent — Fault: ${category}. Remake food: ${
      remakeFood ? "yes" : "no"
    }.${notes ? ` Note: ${notes}` : ""}`
  )
  logActivity(
    o,
    "resent",
    `Reset & resent — ${category}${remakeFood ? " · food remade" : ""}`
  )
}

export function messageCustomer(o: Order, text: string): void {
  pushInteraction(o, "msg", `“${text}”`)
  logActivity(o, "message", `Messaged ${o.cust.name.split(" ")[0]}`)
}

export function addNote(o: Order, text: string): void {
  pushInteraction(o, "note", text)
  logActivity(o, "note", "Added a note")
}

const FIRST_NAMES = [
  "Oisín",
  "Saoirse",
  "Fionn",
  "Aoife",
  "Cillian",
  "Róisín",
  "Tadhg",
  "Méabh",
]
const LAST_NAMES = ["Byrne", "Kelly", "Murphy", "Walsh", "O’Brien", "Nolan"]

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

let seq = 0

export function makeOrder(id: string, overrides: Partial<Order> = {}): Order {
  const store = STORES[seq % STORES.length]
  const zone = LANDING_ZONES[seq % LANDING_ZONES.length]
  const first = FIRST_NAMES[seq % FIRST_NAMES.length]
  const last = LAST_NAMES[seq % LAST_NAMES.length]
  seq += 1
  const name = `${first} ${last}`
  const base: Order = {
    id,
    merchant: store.name,
    emoji: store.emoji,
    cellId: zone.cellId,
    zoneId: zone.id,
    group: "attention",
    statusIdx: 0,
    badge: { cls: "action", text: "Accept order" },
    autopilot: false,
    eta: "New",
    total: "18.50",
    weight: "0.9 kg",
    bags: 1,
    needs: {
      title: "New order awaiting acceptance",
      body: "A fresh order just came in and is waiting to be accepted.",
      cta: "Accept now",
    },
    items: [
      { q: 1, n: "House special", o: "", p: "12.50" },
      { q: 1, n: "Side", o: "", p: "6.00" },
    ],
    timeline: [{ k: "CREATED", t: nowHM(), auto: true }],
    cust: {
      name,
      initials: initials(name),
      tier: "New · 1 order",
      rating: 4.5,
      phone: "+353 87 •••• 000",
      eircode: "D15 AA00",
      spot: "Front door",
      joined: "2026",
      history: [],
    },
    intx: [
      {
        type: "sys",
        who: "System",
        text: "Order received.",
        when: "just now",
      },
    ],
  }
  return { ...base, ...overrides }
}

export function nextOrderId(orders: Order[]): string {
  const max = orders.reduce((m, o) => {
    const n = Number.parseInt(o.id, 10)
    return Number.isNaN(n) ? m : Math.max(m, n)
  }, 100)
  return String(max + 1).padStart(4, "0")
}

export function defaultSnapshot(): SimSnapshot {
  const orders = clone(ORDERS)
  orders.forEach(splitOverweight)
  return {
    orders,
    collectors: clone(COLLECTORS),
    stores: clone(STORES),
    messages: clone(MESSAGES),
    systemKind: "weather",
    scope: { kind: "all" },
  }
}
