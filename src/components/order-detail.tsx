import { type ReactNode } from "react"
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronRight,
  Clock,
  RotateCcw,
  Send,
  Siren,
  Store,
  type LucideIcon,
} from "lucide-react"

import {
  cellById,
  payloadGroups,
  slaIsStoreSide,
  slaWarning,
  zoneById,
  type Collector,
  type Order,
} from "@/data"
import type { ActionKind } from "@/sim/model"
import type { ActivityCategory } from "@/lib/activity"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { typographyVariants } from "@/components/ui/typography"
import { cn } from "@/lib/utils"
import { PayloadGroupCard } from "@/components/payload-card"

const TOP_ACTIONS: {
  icon: LucideIcon
  label: string
  kind: ActionKind
  variant?: "outline" | "destructive"
}[] = [
  { icon: Send, label: "Resend", kind: "resend" },
  { icon: RotateCcw, label: "Refund", kind: "refund" },
  { icon: Siren, label: "Escalate", kind: "escalate" },
  { icon: Ban, label: "Cancel", kind: "cancel", variant: "destructive" },
]

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="mt-8 border-t pt-8">
      <h2 className={typographyVariants({ variant: "h6" })}>{title}</h2>
      {description && (
        <p className={cn("mt-1", typographyVariants({ variant: "muted" }))}>
          {description}
        </p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  )
}

const ATTENTION_ALERT =
  "border-attention/30 bg-attention/5 text-attention [&>svg]:text-attention"
const ATTENTION_BTN =
  "bg-attention text-attention-foreground hover:bg-attention/90"

function NeedsAlert({
  order,
  onAct,
  onAction,
}: {
  order: Order
  onAct: (label: string) => void
  onAction: (kind: ActionKind) => void
}) {
  const needs = order.needs
  if (!needs) {
    if (order.cancelled) {
      return (
        <Alert className="rounded-2xl">
          <Ban className="h-4 w-4" />
          <AlertTitle>Order cancelled</AlertTitle>
          <AlertDescription>
            This order was cancelled
            {order.refunded ? " and the customer was fully refunded" : ""}. It no
            longer appears in the active queue.
          </AlertDescription>
        </Alert>
      )
    }
    return (
      <Alert className="rounded-2xl">
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>No action needed</AlertTitle>
        <AlertDescription>
          This order is on track and progressing in the background. You can step in
          and override any step below if needed.
        </AlertDescription>
      </Alert>
    )
  }

  const primary = needs.restricted ? (
    <Button size="sm" className={ATTENTION_BTN} onClick={() => onAction("escalate")}>
      Escalate to supervisor
    </Button>
  ) : (
    <Button
      size="sm"
      className={ATTENTION_BTN}
      onClick={() =>
        needs.cta === "Change delivery spot"
          ? onAction("confirm-spot")
          : onAct(needs.cta!)
      }
    >
      {needs.cta}
    </Button>
  )

  return (
    <Alert className={cn("rounded-2xl", ATTENTION_ALERT)}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{needs.title}</AlertTitle>
      <AlertDescription>
        <p>{needs.body}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {primary}
          {needs.restricted && (
            <Button variant="outline" size="sm" onClick={() => onAction("remake")}>
              Remake payload
            </Button>
          )}
          {needs.allowMessage && (
            <Button variant="outline" size="sm" onClick={() => onAction("message")}>
              Message customer
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}

function AcceptCard({
  order,
  onAction,
}: {
  order: Order
  onAction: (kind: ActionKind) => void
}) {
  const needs = order.needs
  return (
    <Alert className={cn("rounded-2xl", ATTENTION_ALERT)}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{needs ? needs.title : "Accept order"}</AlertTitle>
      <AlertDescription>
        <p>
          {needs
            ? needs.body
            : "Set a kitchen ETA, or leave it to be scheduled in the background."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" className={ATTENTION_BTN} onClick={() => onAction("accept")}>
            Review &amp; accept
          </Button>
          <Button variant="outline" size="sm" onClick={() => onAction("cancel")}>
            Reject
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}

function SlaActionCard({
  order,
  label,
  onAct,
  onAction,
  onContactVendor,
}: {
  order: Order
  label: string
  onAct: (label: string) => void
  onAction: (kind: ActionKind) => void
  onContactVendor: () => void
}) {
  const storeSide = slaIsStoreSide(order)
  return (
    <Alert className={cn("rounded-2xl", ATTENTION_ALERT)}>
      <Clock className="h-4 w-4" />
      <AlertTitle>{label}</AlertTitle>
      <AlertDescription>
        <p>
          {storeSide
            ? "The store hasn't progressed this order within the expected time. Contact the vendor to confirm they're preparing it."
            : "This order is running behind its expected timeline. Check in and decide whether to escalate."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {storeSide ? (
            <>
              <Button
                size="sm"
                className={ATTENTION_BTN}
                onClick={onContactVendor}
              >
                <Store />
                Contact vendor
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAction("escalate")}
              >
                Escalate to supervisor
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              className={ATTENTION_BTN}
              onClick={() => onAction("escalate")}
            >
              Escalate to supervisor
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}

export function OrderDetail({
  order,
  collectors,
  onAct,
  onAction,
  onOpenCollectors,
  onOpenVendor,
}: {
  order: Order | undefined
  collectors: Collector[]
  onAct: (label: string) => void
  onAction: (kind: ActionKind) => void
  onOpenCollectors: (pid: string) => void
  onOpenVendor: (order: Order) => void
}) {
  if (!order) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted-foreground">
        Select an order.
      </div>
    )
  }

  const groups = payloadGroups(order)
  const multi = groups.length > 1
  const useCarousel = groups.length > 2
  const gridCols = multi ? "repeat(2, minmax(0,1fr))" : "1fr"

  const activityAction = (category: ActivityCategory) => {
    if (category === "waiting") {
      if (slaIsStoreSide(order)) onOpenVendor(order)
      else onAction("escalate")
      return
    }
    if (order.statusIdx === 0 && !order.cancelled) return onAction("accept")
    const needs = order.needs
    if (!needs) return
    if (needs.restricted) return onAction("escalate")
    if (needs.cta === "Change delivery spot") return onAction("confirm-spot")
    onAct(needs.cta ?? needs.title)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b px-6">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border bg-muted text-base">
          {order.emoji}
        </div>
        <div className="flex min-w-0 flex-col justify-center">
          <span className="flex min-w-0 items-center font-semibold leading-tight tracking-tight">
            <span className="shrink-0">{order.id}&nbsp;·&nbsp;</span>
            <button
              type="button"
              onClick={() => onOpenVendor(order)}
              className="inline-flex min-w-0 items-center gap-0.5 rounded underline-offset-2 transition-colors hover:text-primary hover:underline"
            >
              <span className="truncate">{order.merchant}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </span>
          <span className="truncate text-sm leading-tight text-muted-foreground">
            {cellById(order.cellId)?.name} · {zoneById(order.zoneId)?.name} · €
            {order.total}
          </span>
        </div>
        <TooltipProvider>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {TOP_ACTIONS.map((a) => {
              const Icon = a.icon
              return (
                <Tooltip key={a.label}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={a.variant ?? "outline"}
                      size="icon-sm"
                      className="rounded-full"
                      onClick={() => onAction(a.kind)}
                    >
                      <Icon />
                      <span className="sr-only">{a.label}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{a.label}</TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </TooltipProvider>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 pb-16 pt-8">
          {(() => {
            const w = slaWarning(order)
            if (order.statusIdx === 0 && !order.cancelled) {
              return <AcceptCard order={order} onAction={onAction} />
            }
            if (order.needs) {
              return <NeedsAlert order={order} onAct={onAct} onAction={onAction} />
            }
            if (!order.cancelled && w.level !== "none") {
              return (
                <SlaActionCard
                  order={order}
                  label={w.label}
                  onAct={onAct}
                  onAction={onAction}
                  onContactVendor={() => onOpenVendor(order)}
                />
              )
            }
            return <NeedsAlert order={order} onAct={onAct} onAction={onAction} />
          })()}

          <Section
        title={`Deliveries · ${groups.length} payload${groups.length > 1 ? "s" : ""}`}
        description={
          multi
            ? "This order ships as separate payloads. Each flies on its own drone and can be at a different stage — one may deliver before another even starts."
            : "Highlighted steps are the ones that need a human — everything else just happens in the background."
        }
      >
        {useCarousel ? (
          <Carousel opts={{ align: "start" }} className="w-full">
            <div className="mb-3 flex items-center justify-end gap-2">
              <CarouselPrevious className="static size-8 translate-x-0 translate-y-0" />
              <CarouselNext className="static size-8 translate-x-0 translate-y-0" />
            </div>
            <CarouselContent className="items-start">
              {groups.map((g, i) => (
                <CarouselItem
                  key={g.letter ?? "single-" + i}
                  className="basis-full sm:basis-1/2"
                >
                  <PayloadGroupCard
                    order={order}
                    group={g}
                    collectors={collectors}
                    onOpenCollectors={onOpenCollectors}
                    onActivityAction={activityAction}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        ) : (
          <div
            className="grid items-start gap-4"
            style={{ gridTemplateColumns: gridCols }}
          >
            {groups.map((g, i) => (
              <PayloadGroupCard
                key={g.letter ?? "single-" + i}
                order={order}
                group={g}
                collectors={collectors}
                onOpenCollectors={onOpenCollectors}
                onActivityAction={activityAction}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title="Order">
        <div className="space-y-3">
          {order.items.map((it, i) => (
            <div key={i} className="flex gap-3 text-sm">
              <span className="w-7 shrink-0 text-muted-foreground">{it.q}×</span>
              <div className="flex-1">
                <div>{it.n}</div>
                {it.o && <div className="text-muted-foreground">{it.o}</div>}
              </div>
              <span className="font-medium">€{it.p}</span>
            </div>
          ))}
          <Separator />
          <div className="flex text-sm font-medium">
            <span>Total</span>
            <span className="ml-auto">€{order.total}</span>
          </div>
        </div>
      </Section>

        </div>
      </div>
    </div>
  )
}
