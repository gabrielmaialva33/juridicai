import { Head, router } from '@inertiajs/react'
import { useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { Calendar, Clock, GripVertical } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '~/components/shared/page-header'
import { fmtBRL, fmtNum, fmtRelative } from '~/lib/helpers'
import { cn } from '@/lib/utils'

type Opportunity = {
  id: string
  asset: {
    id: string
    cnjNumber?: string | null
    debtorName?: string | null
    nature: string
    faceValue: number
    exerciseYear?: number | null
  }
  debtor: {
    historicalMultiplier: number
  }
  pipeline: {
    stage: string
    targetCloseAt?: string | null
    lastContactedAt?: string | null
    priority?: number
  }
  pricing: {
    riskAdjustedIrr: number
    grade: string
    offerValue: number
    paymentProbability: number
  }
}

type Stage = {
  stage: string
  count: number
  faceValueTotal: number
  averageRiskAdjustedIrr: number
  items: Opportunity[]
}

type Props = {
  stages: Stage[]
}

const STAGE_META: Record<
  string,
  { label: string; color: string; bg: string; description: string }
> = {
  inbox: {
    label: 'Inbox',
    color: 'border-slate-400',
    bg: 'bg-slate-50 dark:bg-slate-900/40',
    description: 'Não tocadas',
  },
  qualified: {
    label: 'Qualificada',
    color: 'border-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    description: 'Prontas pra contato',
  },
  contact: {
    label: 'Em contato',
    color: 'border-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    description: 'Cedente engajado',
  },
  offer: {
    label: 'Oferta',
    color: 'border-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    description: 'Proposta enviada',
  },
  due_diligence: {
    label: 'Due Diligence',
    color: 'border-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    description: 'Validação documental',
  },
  cession: {
    label: 'Cessão',
    color: 'border-fuchsia-400',
    bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/40',
    description: 'Contrato assinado',
  },
  paid: {
    label: 'Paga',
    color: 'border-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    description: 'Recebido',
  },
  lost: {
    label: 'Perdida',
    color: 'border-red-400',
    bg: 'bg-red-50 dark:bg-red-950/40',
    description: 'Não fechou',
  },
}

const GRADE_COLOR: Record<string, string> = {
  'A+': 'bg-emerald-500',
  'A': 'bg-emerald-400',
  'B+': 'bg-violet-500',
  'B': 'bg-violet-400',
  'C': 'bg-amber-500',
  'D': 'bg-red-500',
}

const fmtPct = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined ? '—' : `${(value * 100).toFixed(digits)}%`

export default function PipelineKanban({ stages: initialStages }: Props) {
  const [stages, setStages] = useState<Stage[]>(initialStages)
  const [activeOp, setActiveOp] = useState<Opportunity | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const totalAll = stages.reduce((s, st) => s + st.faceValueTotal, 0)
  const activeStages = stages.filter((s) => !['paid', 'lost'].includes(s.stage))
  const totalActive = activeStages.reduce((s, st) => s + st.faceValueTotal, 0)

  function findOp(id: string): { op: Opportunity; stage: string } | null {
    for (const stage of stages) {
      const op = stage.items.find((o) => o.asset.id === id)
      if (op) return { op, stage: stage.stage }
    }
    return null
  }

  function handleDragStart(event: DragStartEvent) {
    const found = findOp(String(event.active.id))
    setActiveOp(found?.op ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveOp(null)
    const { active, over } = event
    if (!over) return

    const sourceFound = findOp(String(active.id))
    if (!sourceFound) return

    const targetStage = String(over.id)
    if (sourceFound.stage === targetStage) return

    // Optimistic update local state
    setStages((prev) => {
      const next = prev.map((s) => ({ ...s, items: [...s.items] }))
      const src = next.find((s) => s.stage === sourceFound.stage)
      const dst = next.find((s) => s.stage === targetStage)
      if (!src || !dst) return prev
      src.items = src.items.filter((o) => o.asset.id !== active.id)
      const moved: Opportunity = {
        ...sourceFound.op,
        pipeline: { ...sourceFound.op.pipeline, stage: targetStage },
      }
      dst.items = [moved, ...dst.items]
      // recompute summary
      for (const s of next) {
        s.count = s.items.length
        s.faceValueTotal = s.items.reduce((sum, o) => sum + o.asset.faceValue, 0)
        s.averageRiskAdjustedIrr =
          s.items.length > 0
            ? s.items.reduce((sum, o) => sum + o.pricing.riskAdjustedIrr, 0) / s.items.length
            : 0
      }
      return next
    })

    // Persist via fetch (endpoint retorna JSON, não Inertia)
    const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? ''
    fetch(`/operations/opportunities/${active.id}/pipeline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
        'Accept': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify({ stage: targetStage }),
    }).catch(() => {
      // rollback se falhar
      router.reload({ only: ['stages'] })
    })
  }

  return (
    <>
      <Head title="Pipeline · Mesa de Operações" />

      <PageHeader
        title="Pipeline"
        description={`${fmtBRL(totalActive)} em pipeline ativo · ${fmtBRL(totalAll)} total movimentado · arraste cards entre colunas`}
        breadcrumbs={[{ label: 'Mesa', href: '/operations/desk' }, { label: 'Pipeline' }]}
      />

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto -mx-4 lg:-mx-8 px-4 lg:px-8 pb-2">
          <div className="flex gap-3 min-w-max">
            {stages.map((stage) => (
              <KanbanColumn key={stage.stage} stage={stage} />
            ))}
          </div>
        </div>

        <DragOverlay>{activeOp ? <PipelineCard op={activeOp} dragging /> : null}</DragOverlay>
      </DndContext>
    </>
  )
}

function KanbanColumn({ stage }: { stage: Stage }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.stage })
  const meta = STAGE_META[stage.stage] ?? {
    label: stage.stage,
    color: 'border-slate-400',
    bg: 'bg-slate-50',
    description: '',
  }
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-shrink-0 w-[300px] rounded-lg border-t-2 transition-colors',
        meta.color,
        meta.bg,
        isOver && 'ring-2 ring-primary/50 ring-offset-1'
      )}
    >
      <div className="p-3 border-b border-border/50">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-semibold text-sm">{meta.label}</h3>
          <span className="text-xs text-muted-foreground tabular-nums">{fmtNum(stage.count)}</span>
        </div>
        <div className="mt-0.5 flex items-baseline justify-between text-xs text-muted-foreground tabular-nums">
          <span>{fmtBRL(stage.faceValueTotal)}</span>
          {stage.count > 0 && <span>TIR {fmtPct(stage.averageRiskAdjustedIrr)}</span>}
        </div>
      </div>
      <div className="p-2 space-y-2 min-h-[180px] max-h-[calc(100vh-260px)] overflow-y-auto">
        {stage.items.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-6 italic">
            {meta.description}
          </div>
        ) : (
          stage.items.map((op) => <DraggableCard key={op.id} op={op} />)
        )}
      </div>
    </div>
  )
}

function DraggableCard({ op }: { op: Opportunity }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: op.asset.id })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      style={{ opacity: isDragging ? 0 : 1 }}
      className="touch-none"
    >
      <PipelineCard
        op={op}
        dragHandle={
          <button
            {...listeners}
            className="absolute top-2 end-2 opacity-0 group-hover:opacity-50 hover:opacity-100 transition-opacity p-0.5 cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="size-3.5" />
          </button>
        }
      />
    </div>
  )
}

function PipelineCard({
  op,
  dragHandle,
  dragging,
}: {
  op: Opportunity
  dragHandle?: React.ReactNode
  dragging?: boolean
}) {
  const targetClose = op.pipeline.targetCloseAt
  const isUrgent =
    targetClose && new Date(targetClose).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000

  return (
    <Card
      onClick={() => !dragging && router.visit(`/operations/opportunities/${op.asset.id}`)}
      className={cn(
        'cursor-pointer hover:shadow-md hover:border-primary/30 transition-all relative group',
        dragging && 'shadow-2xl ring-2 ring-primary/40 cursor-grabbing rotate-1'
      )}
    >
      <CardContent className="p-3 space-y-1.5">
        {dragHandle}
        <div className="flex items-start justify-between gap-2 pe-5">
          <span
            className={`inline-flex items-center justify-center min-w-[28px] h-5 rounded text-[10px] font-bold text-white shrink-0 ${
              GRADE_COLOR[op.pricing.grade] ?? 'bg-muted-foreground'
            }`}
          >
            {op.pricing.grade}
          </span>
          {op.debtor.historicalMultiplier > 1 && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 tabular-nums">
              ⭐ {op.debtor.historicalMultiplier.toFixed(1)}x
            </span>
          )}
        </div>
        <div className="text-sm font-medium truncate">{op.asset.debtorName ?? '—'}</div>
        <div className="text-[10px] font-mono text-muted-foreground truncate">
          {op.asset.cnjNumber ?? op.asset.id.slice(0, 8)}
        </div>
        <div className="flex items-baseline justify-between pt-1 text-xs">
          <span className="tabular-nums font-medium">{fmtBRL(op.pricing.offerValue)}</span>
          <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-bold">
            {fmtPct(op.pricing.riskAdjustedIrr)}
          </span>
        </div>
        <div className="flex items-baseline justify-between text-[10px] text-muted-foreground tabular-nums">
          <span>{op.asset.nature}</span>
          {op.pricing.paymentProbability && <span>P {fmtPct(op.pricing.paymentProbability)}</span>}
        </div>
        {(targetClose || op.pipeline.lastContactedAt) && (
          <div className="flex items-center gap-2 pt-1 border-t border-border/50 text-[10px] text-muted-foreground">
            {targetClose && (
              <span
                className={`flex items-center gap-1 ${
                  isUrgent ? 'text-amber-600 dark:text-amber-400 font-medium' : ''
                }`}
              >
                <Calendar className="size-3" />
                {fmtRelative(targetClose)}
              </span>
            )}
            {op.pipeline.lastContactedAt && !targetClose && (
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                último {fmtRelative(op.pipeline.lastContactedAt)}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
