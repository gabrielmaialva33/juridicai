import { Head, router } from '@inertiajs/react'
import { AlertTriangle, CalendarDays, Check, Clock3, Pencil, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '~/components/shared/page-header'
import { fmtDate } from '~/lib/helpers'

type LegalPublicationRow = {
  id: string
  processNumber: string
  courtAlias: string | null
  communicationType: string | null
  status: string
  availableAt: string | null
  dueAt: string | null
  manualDueAt: string | null
  manualReviewRequired: boolean
  determination: string | null
  actType: string | null
  recommendedAction: string | null
  legalBasis: string | null
  deadlineDays: number | null
  deadlineKind: 'business_days' | 'calendar_days' | null
  hearingAt: string | null
  hearingTime: string | null
  judgmentAt: string | null
  priority: string | null
  confidence: string | null
  validatorReason: string | null
  body: string
}

type AgendaItem = {
  id: string
  publicationId: string
  type: 'deadline' | 'manual_due_date' | 'hearing' | 'judgment'
  title: string
  date: string
  time: string | null
  fatal: boolean
  overdue: boolean
  processNumber: string
  caseLabel: string | null
  courtAlias: string | null
  priority: string | null
  manualReviewRequired: boolean
}

type Props = {
  publications: LegalPublicationRow[]
  agenda: AgendaItem[]
}

export default function LegalPublicationsIndex({ publications, agenda }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deadlineEditId, setDeadlineEditId] = useState<string | null>(null)
  const [interpretationEditId, setInterpretationEditId] = useState<string | null>(null)
  const [manualDueAt, setManualDueAt] = useState('')
  const [interpretationForm, setInterpretationForm] =
    useState<InterpretationForm>(emptyInterpretationForm())

  function postAction(path: string, id: string, data: Record<string, any> = {}) {
    setBusyId(id)
    router.post(path, data, {
      preserveScroll: true,
      onFinish: () => setBusyId(null),
    })
  }

  function openDeadlineEdit(publication: LegalPublicationRow) {
    setInterpretationEditId(null)
    setDeadlineEditId(publication.id)
    setManualDueAt(publication.manualDueAt ?? publication.dueAt ?? '')
  }

  function saveDeadline(publication: LegalPublicationRow) {
    postAction(`/legal-publications/${publication.id}/deadline`, publication.id, {
      manualDueAt: manualDueAt || null,
    })
    setDeadlineEditId(null)
  }

  function openInterpretationEdit(publication: LegalPublicationRow) {
    setDeadlineEditId(null)
    setInterpretationEditId(publication.id)
    setInterpretationForm({
      determination: publication.determination ?? '',
      actType: publication.actType ?? '',
      recommendedAction: publication.recommendedAction ?? '',
      legalBasis: publication.legalBasis ?? '',
      deadlineDays: publication.deadlineDays?.toString() ?? '',
      deadlineKind: publication.deadlineKind ?? '',
      hearingAt: publication.hearingAt ?? '',
      hearingTime: publication.hearingTime ?? '',
      judgmentAt: publication.judgmentAt ?? '',
      priority: publication.priority ?? '',
      notes: '',
    })
  }

  function saveInterpretation(publication: LegalPublicationRow) {
    postAction(`/legal-publications/${publication.id}/interpretation`, publication.id, {
      ...interpretationForm,
      determination: nullableText(interpretationForm.determination),
      actType: nullableText(interpretationForm.actType),
      recommendedAction: nullableText(interpretationForm.recommendedAction),
      legalBasis: nullableText(interpretationForm.legalBasis),
      deadlineDays: interpretationForm.deadlineDays
        ? Number(interpretationForm.deadlineDays)
        : null,
      deadlineKind: nullableText(interpretationForm.deadlineKind),
      hearingAt: nullableText(interpretationForm.hearingAt),
      hearingTime: nullableText(interpretationForm.hearingTime),
      judgmentAt: nullableText(interpretationForm.judgmentAt),
      priority: nullableText(interpretationForm.priority),
      notes: nullableText(interpretationForm.notes),
    })
    setInterpretationEditId(null)
  }

  return (
    <>
      <Head title="Publicações jurídicas" />

      <PageHeader
        title="Publicações jurídicas"
        description="Publicações DJEN ligadas a processos monitorados e ativos de precatório."
      />

      <Card className="mb-6">
        <CardHeader className="py-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" />
            <h2 className="text-base font-semibold">Agenda</h2>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {agenda.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground">
              Nenhum prazo, audiência ou julgamento identificado.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {agenda.map((item) => (
                <li key={item.id} className="px-5 py-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <AgendaIcon item={item} />
                        <span className="font-medium">{agendaTitle(item)}</span>
                        {item.fatal ? (
                          <Badge
                            variant={item.overdue ? 'destructive' : 'warning'}
                            appearance="light"
                          >
                            {item.overdue ? 'Vencido' : 'Prazo fatal'}
                          </Badge>
                        ) : null}
                        {item.manualReviewRequired ? (
                          <Badge variant="warning" appearance="light">
                            Revisar
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {item.caseLabel ?? item.processNumber}
                        {item.courtAlias ? ` · ${item.courtAlias}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground md:text-right">
                      <Clock3 className="size-4" />
                      <span>
                        {fmtDate(item.date)}
                        {item.time ? ` às ${item.time}` : ''}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-4">
          <h2 className="text-base font-semibold">Últimas publicações</h2>
        </CardHeader>
        <CardContent className="p-0">
          {publications.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground">
              Nenhuma publicação jurídica monitorada ainda.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {publications.map((publication) => (
                <li key={publication.id} className="px-5 py-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{publication.processNumber}</span>
                        {publication.courtAlias ? (
                          <Badge variant="outline" appearance="ghost">
                            {publication.courtAlias}
                          </Badge>
                        ) : null}
                        {publication.manualReviewRequired ? (
                          <Badge variant="warning" appearance="light">
                            Revisar
                          </Badge>
                        ) : null}
                        {publication.status === 'confirmed' ? (
                          <Badge variant="success" appearance="light">
                            Confirmada
                          </Badge>
                        ) : null}
                        {publication.status === 'dismissed' ? (
                          <Badge variant="secondary" appearance="light">
                            Descartada
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {publication.body}
                      </p>
                      {publication.validatorReason ? (
                        <p className="mt-2 text-xs text-[var(--color-warning-accent)]">
                          {publication.validatorReason}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground md:text-right">
                      <div>
                        {publication.availableAt ? fmtDate(publication.availableAt) : 'Sem data'}
                      </div>
                      {publication.dueAt ? <div>Prazo: {fmtDate(publication.dueAt)}</div> : null}
                      {publication.hearingAt ? (
                        <div>
                          Audiência: {fmtDate(publication.hearingAt)}
                          {publication.hearingTime ? ` às ${publication.hearingTime}` : ''}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === publication.id || publication.status === 'confirmed'}
                      onClick={() =>
                        postAction(`/legal-publications/${publication.id}/confirm`, publication.id)
                      }
                    >
                      <Check className="size-3.5" />
                      Confirmar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === publication.id || publication.status === 'dismissed'}
                      onClick={() =>
                        postAction(`/legal-publications/${publication.id}/dismiss`, publication.id)
                      }
                    >
                      <X className="size-3.5" />
                      Descartar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === publication.id}
                      onClick={() => openDeadlineEdit(publication)}
                    >
                      <CalendarDays className="size-3.5" />
                      Prazo
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === publication.id}
                      onClick={() => openInterpretationEdit(publication)}
                    >
                      <Pencil className="size-3.5" />
                      Interpretação
                    </Button>
                  </div>

                  {deadlineEditId === publication.id ? (
                    <div className="mt-4 grid gap-3 rounded-md border border-border p-4 md:max-w-sm">
                      <Label htmlFor={`manual-due-${publication.id}`}>Prazo manual</Label>
                      <Input
                        id={`manual-due-${publication.id}`}
                        type="date"
                        value={manualDueAt}
                        onChange={(event) => setManualDueAt(event.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveDeadline(publication)}>
                          Salvar prazo
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeadlineEditId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {interpretationEditId === publication.id ? (
                    <InterpretationEditor
                      form={interpretationForm}
                      onChange={setInterpretationForm}
                      onCancel={() => setInterpretationEditId(null)}
                      onSave={() => saveInterpretation(publication)}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  )
}

type InterpretationForm = {
  determination: string
  actType: string
  recommendedAction: string
  legalBasis: string
  deadlineDays: string
  deadlineKind: string
  hearingAt: string
  hearingTime: string
  judgmentAt: string
  priority: string
  notes: string
}

function InterpretationEditor({
  form,
  onChange,
  onCancel,
  onSave,
}: {
  form: InterpretationForm
  onChange: (form: InterpretationForm) => void
  onCancel: () => void
  onSave: () => void
}) {
  const set = (key: keyof InterpretationForm, value: string) => onChange({ ...form, [key]: value })

  return (
    <div className="mt-4 grid gap-4 rounded-md border border-border p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Tipo do ato">
          <Input value={form.actType} onChange={(event) => set('actType', event.target.value)} />
        </Field>
        <Field label="Dias">
          <Input
            type="number"
            min="1"
            max="365"
            value={form.deadlineDays}
            onChange={(event) => set('deadlineDays', event.target.value)}
          />
        </Field>
        <Field label="Tipo de prazo">
          <select
            className="h-8.5 w-full rounded-md border border-input bg-background px-3 text-[0.8125rem]"
            value={form.deadlineKind}
            onChange={(event) => set('deadlineKind', event.target.value)}
          >
            <option value="">Sem prazo</option>
            <option value="business_days">Dias úteis</option>
            <option value="calendar_days">Dias corridos</option>
          </select>
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Audiência">
          <Input
            type="date"
            value={form.hearingAt}
            onChange={(event) => set('hearingAt', event.target.value)}
          />
        </Field>
        <Field label="Hora">
          <Input
            type="time"
            value={form.hearingTime}
            onChange={(event) => set('hearingTime', event.target.value)}
          />
        </Field>
        <Field label="Julgamento">
          <Input
            type="date"
            value={form.judgmentAt}
            onChange={(event) => set('judgmentAt', event.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Providência">
          <Input
            value={form.recommendedAction}
            onChange={(event) => set('recommendedAction', event.target.value)}
          />
        </Field>
        <Field label="Base legal">
          <Input
            value={form.legalBasis}
            onChange={(event) => set('legalBasis', event.target.value)}
          />
        </Field>
      </div>

      <Field label="Determinação">
        <Textarea
          value={form.determination}
          onChange={(event) => set('determination', event.target.value)}
        />
      </Field>

      <div className="flex gap-2">
        <Button size="sm" onClick={onSave}>
          Salvar interpretação
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function emptyInterpretationForm(): InterpretationForm {
  return {
    determination: '',
    actType: '',
    recommendedAction: '',
    legalBasis: '',
    deadlineDays: '',
    deadlineKind: '',
    hearingAt: '',
    hearingTime: '',
    judgmentAt: '',
    priority: '',
    notes: '',
  }
}

function nullableText(value: string) {
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function agendaTitle(item: AgendaItem) {
  if (item.type === 'hearing') return 'Audiência'
  if (item.type === 'judgment') return 'Sessão de julgamento'
  if (item.type === 'manual_due_date') return 'Prazo manual'
  return item.title
}

function AgendaIcon({ item }: { item: AgendaItem }) {
  if (item.overdue) {
    return <AlertTriangle className="size-4 text-destructive" />
  }

  return <CalendarDays className="size-4 text-primary" />
}
