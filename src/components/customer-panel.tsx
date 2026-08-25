import { useEffect, useState } from "react"
import {
  AlertTriangle,
  ChevronDown,
  Contact,
  Lock,
  Mail,
  MessageSquare,
  Package,
  PencilLine,
  Star,
  Zap,
  type LucideIcon,
} from "lucide-react"

import type { Interaction, Order, PastOrder } from "@/data"
import {
  DropPointPill,
  DropPointRisks,
  hasDropPointRisks,
} from "@/components/order-badges"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { typographyVariants } from "@/components/ui/typography"
import { cn } from "@/lib/utils"

function PanelSection({
  title,
  icon: Icon,
  count,
  defaultOpen = false,
  children,
}: {
  title: string
  icon: LucideIcon
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="border-b">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-6 py-4 text-left outline-none">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-semibold">{title}</span>
        {typeof count === "number" && (
          <Badge
            variant="secondary"
            className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px] tabular-nums"
          >
            {count}
          </Badge>
        )}
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <div className="px-6 pb-6">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function Pair({
  label,
  value,
  action,
}: {
  label: string
  value: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 py-1 text-sm">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="flex-1 font-medium">{value}</span>
      {action}
    </div>
  )
}

const intxIcon: Record<Interaction["type"], React.ReactNode> = {
  sys: <Zap className="h-3.5 w-3.5" />,
  msg: <Mail className="h-3.5 w-3.5" />,
  note: <PencilLine className="h-3.5 w-3.5" />,
  warn: <AlertTriangle className="h-3.5 w-3.5" />,
}

export function CustomerPanel({
  order,
  onAct,
  onEditAddress,
  onEditSpot,
  onSend,
  onOpenPastOrder,
}: {
  order: Order | undefined
  onAct: (label: string) => void
  onEditAddress: () => void
  onEditSpot: () => void
  onSend: (mode: "msg" | "note", text: string) => void
  onOpenPastOrder: (past: PastOrder) => void
}) {
  const [draft, setDraft] = useState("")
  const [note, setNote] = useState("")
  const [phoneRevealed, setPhoneRevealed] = useState(false)

  useEffect(() => {
    setPhoneRevealed(false)
    setDraft("")
    setNote("")
  }, [order?.id])

  if (!order) return <div className="h-full bg-background" />
  const c = order.cust
  const firstName = c.name.split(" ")[0]
  const notes = order.intx.filter((x) => x.type === "note")
  const interactions = order.intx.filter((x) => x.type !== "note")

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-16 shrink-0 items-center border-b px-4">
        <span className={typographyVariants({ variant: "h6" })}>Customer</span>
      </div>
      <div className="border-b p-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="text-base">{c.initials}</AvatarFallback>
          </Avatar>
          <div>
            <div className={typographyVariants({ variant: "h6" })}>{c.name}</div>
            <div className={typographyVariants({ variant: "muted" })}>{c.tier}</div>
            <div className="mt-1 flex items-center gap-1 text-muted-foreground">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="h-3 w-3 fill-current" />
              ))}
              <span className="ml-1 text-xs">{c.rating}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <PanelSection title="Contact details" icon={Contact} defaultOpen>
          <div className="space-y-1">
            <Pair
              label="Phone"
              value={phoneRevealed ? "+353 87 123 4412" : c.phone}
              action={
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => {
                    setPhoneRevealed(true)
                    onAct("Phone revealed (audit logged)")
                  }}
                >
                  Reveal
                </Button>
              }
            />
            <Separator />
            <Pair
              label="Address"
              value={c.eircode}
              action={
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={onEditAddress}
                >
                  Edit
                </Button>
              }
            />
            <Separator />
            <Pair
              label="Delivery spot"
              value={<DropPointPill order={order} />}
              action={
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={onEditSpot}
                >
                  Edit
                </Button>
              }
            />
            {hasDropPointRisks(order) && (
              <div className="pb-2 pl-[6.5rem]">
                <DropPointRisks order={order} />
              </div>
            )}
            <Separator />
            <Pair label="Customer since" value={c.joined} />
          </div>
        </PanelSection>

        <PanelSection
          title="Interactions"
          icon={MessageSquare}
          count={interactions.length}
          defaultOpen
        >
          <div className="space-y-4">
            {interactions.map((x, i) => (
              <div key={i} className="flex gap-3">
                <div
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full",
                    x.type === "warn" && x.severity === "red"
                      ? "bg-destructive/10 text-destructive"
                      : x.type === "warn"
                        ? "bg-amber-500/10 text-amber-600"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {intxIcon[x.type]}
                </div>
                <div className="text-sm">
                  <div>
                    <span className="font-medium">{x.who}</span> {x.text}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {x.when}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </PanelSection>

        <PanelSection title="Notes" icon={PencilLine} count={notes.length}>
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <Lock className="size-3.5 shrink-0" />
                Only your team can see notes
              </div>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add an internal note…"
                className="resize-none border-amber-500/40 bg-background placeholder:text-amber-700/50 focus-visible:border-amber-500/60 focus-visible:ring-amber-500/20"
              />
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  className="bg-amber-500 text-white hover:bg-amber-500/90"
                  onClick={() => {
                    if (!note.trim()) {
                      onAct("Type a note first")
                      return
                    }
                    onSend("note", note.trim())
                    setNote("")
                  }}
                >
                  Add note
                </Button>
              </div>
            </div>

            {notes.length ? (
              notes.map((x, i) => (
                <div key={i} className="flex gap-3">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-500/10 text-amber-600">
                    <PencilLine className="h-3.5 w-3.5" />
                  </div>
                  <div className="text-sm">
                    <div>
                      <span className="font-medium">{x.who}</span> {x.text}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {x.when}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No notes yet.</div>
            )}
          </div>
        </PanelSection>

        <PanelSection
          title="Past orders"
          icon={Package}
          count={c.history.length}
        >
          <div className="space-y-2">
            {c.history.length ? (
              c.history.map((h) => (
                <button
                  key={h.id}
                  onClick={() => onOpenPastOrder(h)}
                  className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-accent/50"
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border bg-muted text-sm">
                    {h.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {h.id} · {h.merchant}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {h.date} · €{h.total}
                    </div>
                  </div>
                  <Badge
                    variant={h.status === "Delivered" ? "outline" : "secondary"}
                    className={cn(
                      "shrink-0",
                      h.status === "Refunded" && "text-amber-600",
                      h.status === "Cancelled" && "text-destructive"
                    )}
                  >
                    {h.status}
                  </Badge>
                </button>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">
                No past orders yet.
              </div>
            )}
          </div>
        </PanelSection>
      </div>

      <div className="border-t p-6">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <MessageSquare className="size-3.5 shrink-0" />
          Message customer
        </div>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${firstName}…`}
          className="resize-none"
        />
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Sent to {firstName} via app push + SMS
          </span>
          <Button
            className="ml-auto"
            size="sm"
            onClick={() => {
              if (!draft.trim()) {
                onAct("Type a message first")
                return
              }
              onSend("msg", draft.trim())
              setDraft("")
            }}
          >
            Send to customer
          </Button>
        </div>
      </div>
    </div>
  )
}
