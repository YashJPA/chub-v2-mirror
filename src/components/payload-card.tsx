import { useRef, useState, type ReactNode } from "react"
import gsap from "gsap"
import { Flip } from "gsap/Flip"
import { useGSAP } from "@gsap/react"
import {
  Ban,
  ChevronDown,
  Plus,
  RotateCcw,
  ShoppingBag,
  Weight,
  type LucideIcon,
} from "lucide-react"

import {
  collectorById,
  payloadId,
  shortName,
  type Collector,
  type Order,
  type PayloadGroup,
  type PayloadVersion,
} from "@/data"
import { buildActivity, type ActivityCategory } from "@/lib/activity"
import { ActionActivity, ActivityRowView } from "@/components/activity-row"
import { EtaPill } from "@/components/status-pill"
import { Button } from "@/components/ui/button"
import { typographyVariants } from "@/components/ui/typography"
import { cn } from "@/lib/utils"

gsap.registerPlugin(useGSAP, Flip)

function MetaChip({
  icon: Icon,
  emoji,
  muted,
  children,
}: {
  icon?: LucideIcon
  emoji?: string
  muted?: boolean
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-sm",
        muted ? "bg-background/60 text-muted-foreground" : "bg-background"
      )}
    >
      {emoji ? (
        <span className="text-[13px] leading-none">{emoji}</span>
      ) : Icon ? (
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      ) : null}
      {children}
    </span>
  )
}

function bagLabel(n: number): string {
  return `${n} ${n === 1 ? "bag" : "bags"}`
}

function Timeline({
  version,
  order,
  collectors,
  onActivityAction,
}: {
  version: PayloadVersion
  order: Order
  collectors: Collector[]
  onActivityAction?: (category: ActivityCategory) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const feed = buildActivity(order, version, collectors)
  const now = feed.now

  const rootRef = useRef<HTMLDivElement>(null)
  const flipState = useRef<ReturnType<typeof Flip.getState> | null>(null)
  const prevNowKey = useRef(now.key)

  useGSAP(
    () => {
      const root = rootRef.current
      if (!root) return
      const targets = root.querySelectorAll<HTMLElement>("[data-flip-id]")
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches

      if (flipState.current && prevNowKey.current !== now.key && !reduced) {
        Flip.from(flipState.current, {
          targets,
          duration: 0.55,
          ease: "power2.inOut",
          onEnter: (els) =>
            gsap.fromTo(
              els,
              { opacity: 0, y: -14 },
              { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }
            ),
          onLeave: (els) =>
            gsap.to(els, {
              opacity: 0,
              y: 12,
              duration: 0.3,
              ease: "power1.in",
            }),
        })
      }
      prevNowKey.current = now.key
      flipState.current = Flip.getState(targets)
    },
    { dependencies: [now.key, expanded, feed.past.length], scope: rootRef }
  )

  return (
    <div ref={rootRef} className="mt-3 space-y-4">
      <div>
        {expanded && (
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Happening now
          </div>
        )}
        <div data-flip-id={now.key}>
          {now.category === "action" || now.category === "waiting" ? (
            <ActionActivity
              row={now}
              onClick={
                onActivityAction
                  ? () => onActivityAction(now.category)
                  : undefined
              }
            />
          ) : (
            <ActivityRowView row={now} />
          )}
        </div>
      </div>

      {feed.past.length > 0 && (
        <>
          {expanded && (
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Past activity
              </div>
              <div className="space-y-3">
                {feed.past.map((r) => (
                  <div key={r.key} data-flip-id={r.key}>
                    <ActivityRowView row={r} />
                  </div>
                ))}
              </div>
            </div>
          )}
          <button
            type="button"
            data-flip-id="timeline-toggle"
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {expanded ? "Hide activity" : `Full activity (${feed.past.length})`}
            <ChevronDown
              className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")}
            />
          </button>
        </>
      )}
    </div>
  )
}

function CollectorChip({
  pid,
  version,
  editable,
  collectors,
  onOpen,
}: {
  pid: string
  version: PayloadVersion
  editable: boolean
  collectors: Collector[]
  onOpen: (pid: string) => void
}) {
  const c = collectorById(collectors, version.collector)
  if (c) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 rounded-full pl-1 pr-3"
        onClick={() => onOpen(pid)}
      >
        <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-[9px] font-medium text-primary-foreground">
          {c.initials}
        </span>
        {shortName(c.name)}
      </Button>
    )
  }
  if (editable) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 rounded-full border-dashed"
        onClick={() => onOpen(pid)}
      >
        <Plus className="h-3.5 w-3.5" />
        Assign collector
      </Button>
    )
  }
  return null
}

export function PayloadGroupCard({
  order,
  group,
  collectors,
  onOpenCollectors,
  onActivityAction,
}: {
  order: Order
  group: PayloadGroup
  collectors: Collector[]
  onOpenCollectors: (pid: string) => void
  onActivityAction?: (category: ActivityCategory) => void
}) {
  const active = group.versions[group.versions.length - 1]
  const olds = group.versions.slice(0, group.versions.length - 1)
  const activeIdx = group.versions.length - 1
  const activePid = payloadId(order, group)

  const vName = (idx: number) =>
    group.single ? "Single delivery" : `${order.id}-${group.letter}${idx + 1}`

  const etaText =
    !active.blocked && active.statusIdx < 6 && active.eta?.startsWith("ETA")
      ? active.eta
      : null
  const collectorEditable = active.statusIdx < 5

  return (
    <div className="flex flex-col">
      <div className="mb-2 text-sm font-medium">
        {group.single ? "Single delivery" : "Payload " + group.letter}
      </div>

      {olds.map((v, idx) => {
        const hasChips = v.weight || v.bags || v.collector
        return (
          <div key={idx}>
            <div className="rounded-2xl border border-dashed bg-muted/50 p-4 text-muted-foreground">
              <div className="mb-2 text-sm font-medium">{vName(idx)}</div>
              <ActivityRowView
                row={{
                  key: `${activePid}-terminal-${idx}`,
                  label: v.badge || "Aborted",
                  category: "done",
                  icon: v.badge === "Remade" ? RotateCcw : Ban,
                }}
              />
              {v.outcome && <div className="mt-1.5 text-xs">{v.outcome}</div>}
              {hasChips && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
                  {v.weight && <MetaChip icon={Weight} muted>{v.weight}</MetaChip>}
                  {v.bags ? (
                    <MetaChip icon={ShoppingBag} muted>{bagLabel(v.bags)}</MetaChip>
                  ) : null}
                  <CollectorChip
                    pid={activePid}
                    version={v}
                    editable={false}
                    collectors={collectors}
                    onOpen={onOpenCollectors}
                  />
                </div>
              )}
            </div>
            <div className="ml-3 h-5 w-px bg-border" />
            <div className="-mt-3 ml-6 mb-1 text-xs text-muted-foreground">
              ↳ remade as {vName(idx + 1)}
            </div>
          </div>
        )
      })}

      <div className="rounded-2xl border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md">
        <div className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className={typographyVariants({ variant: "h6" })}>
              {group.single ? "Delivery" : vName(activeIdx)}
            </span>
            {etaText && (
              <EtaPill
                eta={etaText}
                group={order.group}
                delayed={order.delayed}
                className="ml-auto"
              />
            )}
          </div>
          <Timeline
            version={active}
            order={order}
            collectors={collectors}
            onActivityAction={onActivityAction}
          />
          <div className="mt-4 border-t pt-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {active.weight && <MetaChip icon={Weight}>{active.weight}</MetaChip>}
              {active.bags ? (
                <MetaChip icon={ShoppingBag}>{bagLabel(active.bags)}</MetaChip>
              ) : null}
              <CollectorChip
                pid={activePid}
                version={active}
                editable={collectorEditable}
                collectors={collectors}
                onOpen={onOpenCollectors}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
