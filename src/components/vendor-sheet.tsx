import {
  Clock,
  MapPin,
  MessageSquare,
  Phone,
  Star,
  UtensilsCrossed,
} from "lucide-react"

import { MANNA_BASE, statusLabel, type Order, type Store } from "@/data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Item,
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

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border bg-muted/50 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-medium">{value}</div>
      </div>
    </div>
  )
}

export function VendorSheet({
  open,
  onOpenChange,
  orders,
  stores,
  vendorName,
  onAct,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  orders: Order[]
  stores: Store[]
  vendorName: string | null
  onAct: (label: string) => void
}) {
  const store = vendorName
    ? stores.find((s) => s.name === vendorName)
    : undefined
  const vendorOrders = vendorName
    ? orders.filter((o) => o.merchant === vendorName)
    : []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-[440px] max-w-[92vw] flex-col gap-0 p-0 sm:w-[520px] sm:max-w-[520px]">
        <SheetHeader className="space-y-1 border-b p-6 text-left">
          <SheetTitle>{store?.name ?? "Vendor"}</SheetTitle>
          <SheetDescription>
            {store ? store.cuisine : "Vendor details"}
          </SheetDescription>
        </SheetHeader>

        {store ? (
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border bg-muted text-2xl">
                {store.emoji}
              </div>
              <div className="min-w-0">
                <div className="text-base font-semibold tracking-tight">
                  {store.name}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {store.rating.toFixed(1)}
                  </span>
                  <span>·</span>
                  <span>Open · {store.hours}</span>
                </div>
              </div>
            </div>

            <div className="relative h-44 overflow-hidden rounded-2xl border bg-muted/40">
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
              <Pin x={store.x} y={store.y} label={store.name.split(" ")[0]}>
                <div className="grid h-8 w-8 place-items-center rounded-md border-2 border-background bg-background text-base shadow">
                  {store.emoji}
                </div>
              </Pin>
            </div>

            <div className="grid grid-cols-1 gap-1">
              <DetailRow icon={Phone} label="Phone" value={store.phone} />
              <DetailRow icon={MapPin} label="Address" value={store.address} />
              <DetailRow
                icon={Clock}
                label="Avg prep time"
                value={store.prepAvg}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => onAct(`Calling ${store.name}`)}
              >
                <Phone className="h-3.5 w-3.5" />
                Call vendor
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => onAct(`Message sent to ${store.name}`)}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Message
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => onAct(`Opening ${store.name} menu`)}
              >
                <UtensilsCrossed className="h-3.5 w-3.5" />
                View menu
              </Button>
            </div>

            <div>
              <div className="mb-3 text-xs font-medium text-muted-foreground">
                Live orders · {vendorOrders.length}
              </div>
              {vendorOrders.length ? (
                <div className="space-y-2">
                  {vendorOrders.map((o) => (
                    <Item key={o.id} variant="outline" className="gap-2">
                      <ItemContent>
                        <ItemTitle>{o.id}</ItemTitle>
                        <ItemDescription>
                          {o.items.length} item{o.items.length === 1 ? "" : "s"} ·
                          €{o.total}
                        </ItemDescription>
                      </ItemContent>
                      <Badge
                        variant="secondary"
                        className={cn(
                          o.group === "attention" &&
                            "border-transparent bg-attention text-attention-foreground"
                        )}
                      >
                        {statusLabel(o)}
                      </Badge>
                    </Item>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No live orders from this vendor.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid flex-1 place-items-center p-6 text-sm text-muted-foreground">
            Select a vendor.
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
