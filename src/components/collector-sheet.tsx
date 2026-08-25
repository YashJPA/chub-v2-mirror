import { Bell } from "lucide-react"

import {
  MANNA_BASE,
  STORES,
  assignedTo,
  statusLabel,
  unassignedPayloads,
  type Collector,
  type Order,
} from "@/data"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

function Pin({
  x,
  y,
  label,
  children,
}: {
  x: number
  y: number
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      className="absolute z-[2] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {children}
      <span className="whitespace-nowrap rounded bg-background/90 px-1.5 py-px text-[10px] font-medium text-foreground">
        {label}
      </span>
    </div>
  )
}

function MapLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex gap-4 text-xs text-muted-foreground", className)}>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" /> Collector
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full border bg-background" /> Store
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground" /> Idle
      </span>
    </div>
  )
}

function CollectorMap({
  orders,
  collectors,
}: {
  orders: Order[]
  collectors: Collector[]
}) {
  return (
    <div className="flex flex-col sm:h-full">
      <div className="relative h-52 overflow-hidden rounded-2xl border bg-muted/40 sm:h-auto sm:flex-1">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        />
        <Pin x={MANNA_BASE.x} y={MANNA_BASE.y} label="Manna base">
          <div className="grid h-7 w-7 place-items-center rounded-full bg-primary text-sm text-primary-foreground shadow">
            📡
          </div>
        </Pin>
        {STORES.map((s) => (
          <Pin key={s.name} x={s.x} y={s.y} label={s.name.split(" ")[0]}>
            <div className="grid h-6 w-6 place-items-center rounded-md border bg-background text-[13px] shadow-sm">
              {s.emoji}
            </div>
          </Pin>
        ))}
        {collectors.map((c) => {
          const idle = assignedTo(orders, c.id).length === 0
          return (
            <Pin key={c.id} x={c.x} y={c.y} label={c.name.split(" ")[0]}>
              <div
                className={cn(
                  "grid h-6 w-6 place-items-center rounded-full border-2 border-background text-[10px] font-medium shadow",
                  idle
                    ? "bg-muted-foreground text-background"
                    : "bg-primary text-primary-foreground"
                )}
              >
                {c.initials}
              </div>
            </Pin>
          )
        })}
        <MapLegend className="absolute bottom-3 left-3 z-[3] hidden rounded-lg bg-background/90 px-3 py-1.5 shadow-sm sm:flex" />
      </div>
      <MapLegend className="mt-2 sm:hidden" />
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-6 text-xs font-medium text-muted-foreground first:mt-0">
      {children}
    </div>
  )
}

export function CollectorSheet({
  open,
  onOpenChange,
  orders,
  collectors,
  highlightId,
  onAssign,
  onPrioritise,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  orders: Order[]
  collectors: Collector[]
  highlightId: string | null
  onAssign: (pid: string) => void
  onPrioritise: (pid: string) => void
}) {
  const unassigned = unassignedPayloads(orders)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-[440px] max-w-[92vw] flex-col gap-0 p-0 sm:w-[880px] sm:max-w-[880px]">
        <SheetHeader className="space-y-1 border-b p-6 text-left">
          <SheetTitle>Collectors</SheetTitle>
          <SheetDescription>Live store pickups &amp; runs to base</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6 sm:flex-row-reverse sm:overflow-hidden">
          <div className="min-w-0 sm:flex-1 sm:basis-0">
            <CollectorMap orders={orders} collectors={collectors} />
          </div>

          <div className="min-w-0 sm:flex-1 sm:basis-0 sm:overflow-y-auto">
              <SectionTitle>Collectors · {collectors.length}</SectionTitle>
              <div className="space-y-3">
            {collectors.map((c) => {
              const mine = assignedTo(orders, c.id)
              return (
                <div key={c.id} className="rounded-2xl border p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs">{c.initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.status}</div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {mine.length ? (
                      mine.map((p) => (
                        <Item
                          key={p.pid}
                          variant="muted"
                          size="sm"
                          className={cn(
                            "gap-2 py-2",
                            p.pid === highlightId && "ring-1 ring-primary"
                          )}
                        >
                          <ItemContent className="flex-row items-center gap-2">
                            <ItemTitle>{p.label}</ItemTitle>
                            <span className="text-muted-foreground">
                              {p.order.merchant}
                            </span>
                          </ItemContent>
                          <ItemActions>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Prioritise ASAP"
                              onClick={() => onPrioritise(p.pid)}
                            >
                              <Bell />
                            </Button>
                          </ItemActions>
                        </Item>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        No pickups assigned
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <SectionTitle>Unassigned pickups · {unassigned.length}</SectionTitle>
          {unassigned.length ? (
            <div className="space-y-2">
              {unassigned.map((p) => (
                <Item
                  key={p.pid}
                  variant="outline"
                  className={cn(
                    "gap-2",
                    p.pid === highlightId && "ring-1 ring-primary"
                  )}
                >
                  <ItemContent>
                    <ItemTitle>{p.label}</ItemTitle>
                    <ItemDescription>
                      {p.order.merchant} · {statusLabel(p.order)}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button size="sm" onClick={() => onAssign(p.pid)}>
                      Assign
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      title="Prioritise ASAP"
                      onClick={() => onPrioritise(p.pid)}
                    >
                      <Bell />
                    </Button>
                  </ItemActions>
                </Item>
              ))}
            </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  All pickups are assigned.
                </div>
              )}
            </div>
          </div>
      </SheetContent>
    </Sheet>
  )
}
