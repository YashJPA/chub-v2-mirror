import { Search } from "lucide-react"

import {
  cellById,
  effectiveGroup,
  orderInScope,
  slaIsStoreSide,
  slaWarning,
  zoneById,
  type Collector,
  type LocationScope,
  type Order,
  type OrderGroup,
} from "@/data"
import { orderActivity } from "@/lib/activity"
import { ActionActivity, ActivityRowView } from "@/components/activity-row"
import { TakeoffBadge } from "@/components/order-badges"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Item, ItemContent, ItemTitle } from "@/components/ui/item"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EtaPill } from "@/components/status-pill"
import { cn } from "@/lib/utils"

export type FilterKey = "attention" | "all" | "flight" | "done"

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "attention", label: "Needs you" },
  { key: "all", label: "All" },
  { key: "flight", label: "In flight" },
  { key: "done", label: "Completed" },
]

const GROUP_LABELS: { key: OrderGroup; label: string }[] = [
  { key: "attention", label: "Needs your attention" },
  { key: "flight", label: "No action needed" },
  { key: "done", label: "Completed" },
]

function OrderRow({
  order,
  selected,
  collectors,
  onSelect,
  onQuickAction,
  onOrderAction,
}: {
  order: Order
  selected: boolean
  collectors: Collector[]
  onSelect: (id: string) => void
  onQuickAction: (order: Order, kind: "contact-vendor" | "escalate") => void
  onOrderAction: (order: Order) => void
}) {
  const sla = slaWarning(order)
  const showTakeoff =
    typeof order.takeoffInMin === "number" &&
    !order.cancelled &&
    !order.needs &&
    order.statusIdx === 4
  const now = orderActivity(order, collectors)
  return (
    <Item
      asChild
      size="sm"
      className={cn(
        "mb-2 cursor-pointer rounded-2xl border-border bg-card text-card-foreground transition-shadow hover:shadow-md",
        selected && "border-primary bg-accent",
        !selected && sla.level === "yellow" && "bg-amber-500/5",
        !selected && sla.level === "red" && "bg-destructive/5"
      )}
    >
      <button onClick={() => onSelect(order.id)} className="w-full text-left">
        <ItemContent>
          <div className="flex items-start gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border bg-muted text-base">
              {order.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <ItemTitle>
                {order.id}
                <span className="font-normal text-muted-foreground">
                  {order.merchant}
                </span>
              </ItemTitle>
              <span className="text-xs text-muted-foreground">
                {cellById(order.cellId)?.name} · {zoneById(order.zoneId)?.name}
              </span>
            </div>
            <EtaPill
              eta={order.eta}
              group={order.group}
              delayed={order.delayed}
              className="mt-0.5 shrink-0"
            />
          </div>
          <div className="my-1.5 h-px w-full bg-border" />
          {now.category === "action" ? (
            <ActionActivity row={now} onClick={() => onOrderAction(order)} />
          ) : now.category === "waiting" ? (
            <ActionActivity
              row={now}
              onClick={() =>
                onQuickAction(
                  order,
                  slaIsStoreSide(order) ? "contact-vendor" : "escalate"
                )
              }
            />
          ) : (
            <ActivityRowView row={now} />
          )}
          {showTakeoff && (
            <TakeoffBadge minutes={order.takeoffInMin!} variant="text" />
          )}
        </ItemContent>
      </button>
    </Item>
  )
}

export function OrderList({
  orders,
  collectors,
  filter,
  setFilter,
  query,
  setQuery,
  selectedId,
  onSelect,
  onQuickAction,
  onOrderAction,
  counts,
  scope,
}: {
  orders: Order[]
  collectors: Collector[]
  filter: FilterKey
  setFilter: (f: FilterKey) => void
  query: string
  setQuery: (q: string) => void
  selectedId: string
  onSelect: (id: string) => void
  onQuickAction: (order: Order, kind: "contact-vendor" | "escalate") => void
  onOrderAction: (order: Order) => void
  counts: Record<FilterKey, number>
  scope: LocationScope
}) {
  const q = query.toLowerCase()
  const list = orders.filter((o) => {
    const inFilter = filter === "all" || effectiveGroup(o) === filter
    const inSearch =
      !q ||
      (o.id + o.merchant + o.cust.name + o.cust.eircode).toLowerCase().includes(q)
    return orderInScope(o, scope) && inFilter && inSearch
  })

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-6">
        <span className="text-base font-semibold tracking-tight">Orders</span>
        <Badge
          variant="secondary"
          className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px] tabular-nums"
        >
          {counts.all}
        </Badge>
      </div>
      <div className="flex shrink-0 flex-col gap-4 border-b p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search orders, customers, addresses"
            className="pl-8"
          />
        </div>
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              variant={filter === f.key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex-1 gap-1 px-2 text-xs",
                filter === f.key &&
                  f.key === "attention" &&
                  "bg-attention text-attention-foreground hover:bg-attention/90"
              )}
            >
              <span className="truncate">{f.label}</span>
              <span className="opacity-60">{counts[f.key]}</span>
            </Button>
          ))}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-2">
          {!list.length && (
            <div className="px-2 py-16 text-center text-sm text-muted-foreground">
              No orders match.
            </div>
          )}
          {filter === "all"
            ? GROUP_LABELS.map(({ key, label }) => {
                const items = list.filter((o) => effectiveGroup(o) === key)
                if (!items.length) return null
                return (
                  <div key={key} className="mb-1">
                    <div className="px-4 py-2 text-xs font-medium text-muted-foreground">
                      {label}
                    </div>
                    {items.map((o) => (
                      <OrderRow
                        key={o.id}
                        order={o}
                        selected={o.id === selectedId}
                        collectors={collectors}
                        onSelect={onSelect}
                        onQuickAction={onQuickAction}
                        onOrderAction={onOrderAction}
                      />
                    ))}
                  </div>
                )
              })
            : list.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  selected={o.id === selectedId}
                  collectors={collectors}
                  onSelect={onSelect}
                  onQuickAction={onQuickAction}
                  onOrderAction={onOrderAction}
                />
              ))}
        </div>
      </ScrollArea>
    </div>
  )
}
