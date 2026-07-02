import { Head, router } from '@inertiajs/react'
import { BriefcaseBusiness, Check, Gavel, Plus, Power, PowerOff, Scale } from 'lucide-react'
import { useState, type ReactElement, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '~/components/shared/empty-state'
import { PageHeader } from '~/components/shared/page-header'
import { fmtDate, fmtNum } from '~/lib/helpers'

type MonitoredCaseRow = {
  id: string
  cnjNumber: string
  label: string | null
  clientPartySide: 'plaintiff' | 'defendant' | null
  active: boolean
  monitoredBarRegistrationId: string | null
  monitoredBarRegistration: {
    id: string
    barNumber: string
    stateCode: string
    lawyerName: string | null
  } | null
  publicationCount: number
  latestAvailableAt: string | null
}

type BarRegistrationRow = {
  id: string
  barNumber: string
  stateCode: string
  lawyerName: string | null
  active: boolean
  publicationCount: number
  latestAvailableAt: string | null
}

type Props = {
  cases: MonitoredCaseRow[]
  barRegistrations: BarRegistrationRow[]
  summary: {
    activeCases: number
    activeBarRegistrations: number
    capturedPublications: number
  }
}

const STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]

export default function LegalPublicationMonitoring({ cases, barRegistrations, summary }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [caseForm, setCaseForm] = useState<CaseForm>(emptyCaseForm())
  const [barForm, setBarForm] = useState<BarForm>(emptyBarForm())

  function submitCase() {
    const editing = Boolean(caseForm.id)
    const url = editing
      ? `/legal-publications/monitoring/cases/${caseForm.id}`
      : '/legal-publications/monitoring/cases'

    router.post(
      url,
      {
        cnjNumber: caseForm.cnjNumber,
        label: nullableText(caseForm.label),
        clientPartySide: nullableText(caseForm.clientPartySide),
        monitoredBarRegistrationId: nullableText(caseForm.monitoredBarRegistrationId),
      },
      {
        preserveScroll: true,
        onSuccess: () => setCaseForm(emptyCaseForm()),
      }
    )
  }

  function submitBarRegistration() {
    const editing = Boolean(barForm.id)
    const url = editing
      ? `/legal-publications/monitoring/bar-registrations/${barForm.id}`
      : '/legal-publications/monitoring/bar-registrations'

    router.post(
      url,
      {
        barNumber: barForm.barNumber,
        stateCode: barForm.stateCode,
        lawyerName: nullableText(barForm.lawyerName),
      },
      {
        preserveScroll: true,
        onSuccess: () => setBarForm(emptyBarForm()),
      }
    )
  }

  function toggleCase(row: MonitoredCaseRow) {
    setBusyId(row.id)
    router.post(
      `/legal-publications/monitoring/cases/${row.id}/active`,
      { active: !row.active },
      { preserveScroll: true, onFinish: () => setBusyId(null) }
    )
  }

  function toggleBarRegistration(row: BarRegistrationRow) {
    setBusyId(row.id)
    router.post(
      `/legal-publications/monitoring/bar-registrations/${row.id}/active`,
      { active: !row.active },
      { preserveScroll: true, onFinish: () => setBusyId(null) }
    )
  }

  return (
    <>
      <Head title="Monitoramento jurídico" />

      <PageHeader
        title="Monitoramento jurídico"
        description="Processos e OABs usados para captar publicações DJEN e alimentar a agenda."
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Metric title="Processos ativos" value={summary.activeCases} icon={<Scale />} />
        <Metric
          title="OABs ativas"
          value={summary.activeBarRegistrations}
          icon={<BriefcaseBusiness />}
        />
        <Metric
          title="Publicações captadas"
          value={summary.capturedPublications}
          icon={<Gavel />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <Card>
          <CardHeader className="py-4">
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <h2 className="text-base font-semibold">Processos monitorados</h2>
              <span className="text-sm text-muted-foreground">
                {fmtNum(cases.length)} registros
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 rounded-md border border-border p-4 lg:grid-cols-[1.2fr_0.8fr_0.55fr_0.8fr_auto]">
              <Field label="Número CNJ">
                <Input
                  value={caseForm.cnjNumber}
                  placeholder="0000000-00.0000.0.00.0000"
                  onChange={(event) => setCaseForm({ ...caseForm, cnjNumber: event.target.value })}
                />
              </Field>
              <Field label="Apelido">
                <Input
                  value={caseForm.label}
                  placeholder="Cliente ou referência"
                  onChange={(event) => setCaseForm({ ...caseForm, label: event.target.value })}
                />
              </Field>
              <Field label="Polo">
                <select
                  className="h-8.5 w-full rounded-md border border-input bg-background px-3 text-[0.8125rem]"
                  value={caseForm.clientPartySide}
                  onChange={(event) =>
                    setCaseForm({ ...caseForm, clientPartySide: event.target.value })
                  }
                >
                  <option value="">Não definido</option>
                  <option value="plaintiff">Autor</option>
                  <option value="defendant">Réu</option>
                </select>
              </Field>
              <Field label="OAB vinculada">
                <select
                  className="h-8.5 w-full rounded-md border border-input bg-background px-3 text-[0.8125rem]"
                  value={caseForm.monitoredBarRegistrationId}
                  onChange={(event) =>
                    setCaseForm({ ...caseForm, monitoredBarRegistrationId: event.target.value })
                  }
                >
                  <option value="">Sem vínculo</option>
                  {barRegistrations.map((registration) => (
                    <option key={registration.id} value={registration.id}>
                      {registration.barNumber}/{registration.stateCode}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex items-end gap-2">
                <Button size="sm" onClick={submitCase} disabled={!caseForm.cnjNumber}>
                  {caseForm.id ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                  {caseForm.id ? 'Salvar' : 'Adicionar'}
                </Button>
                {caseForm.id ? (
                  <Button size="sm" variant="ghost" onClick={() => setCaseForm(emptyCaseForm())}>
                    Cancelar
                  </Button>
                ) : null}
              </div>
            </div>

            {cases.length === 0 ? (
              <EmptyState
                message="Nenhum processo monitorado"
                description="Adicione um CNJ para acompanhar publicações relacionadas ao processo."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Processo</TableHead>
                    <TableHead>Polo</TableHead>
                    <TableHead>OAB</TableHead>
                    <TableHead className="text-end">Publicações</TableHead>
                    <TableHead>Última</TableHead>
                    <TableHead className="w-[170px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.cnjNumber}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.label ?? 'Sem apelido'}
                        </div>
                      </TableCell>
                      <TableCell>{partySideLabel(row.clientPartySide)}</TableCell>
                      <TableCell>
                        {row.monitoredBarRegistration
                          ? `${row.monitoredBarRegistration.barNumber}/${row.monitoredBarRegistration.stateCode}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {fmtNum(row.publicationCount)}
                      </TableCell>
                      <TableCell>
                        {row.latestAvailableAt ? fmtDate(row.latestAvailableAt) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setCaseForm(caseFormFrom(row))}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant={row.active ? 'outline' : 'secondary'}
                            disabled={busyId === row.id}
                            onClick={() => toggleCase(row)}
                          >
                            {row.active ? (
                              <PowerOff className="size-3.5" />
                            ) : (
                              <Power className="size-3.5" />
                            )}
                            {row.active ? 'Pausar' : 'Ativar'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-4">
            <h2 className="text-base font-semibold">OABs monitoradas</h2>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 rounded-md border border-border p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_90px]">
                <Field label="Número">
                  <Input
                    value={barForm.barNumber}
                    onChange={(event) => setBarForm({ ...barForm, barNumber: event.target.value })}
                  />
                </Field>
                <Field label="UF">
                  <select
                    className="h-8.5 w-full rounded-md border border-input bg-background px-3 text-[0.8125rem]"
                    value={barForm.stateCode}
                    onChange={(event) => setBarForm({ ...barForm, stateCode: event.target.value })}
                  >
                    {STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Advogado">
                <Input
                  value={barForm.lawyerName}
                  placeholder="Nome opcional"
                  onChange={(event) => setBarForm({ ...barForm, lawyerName: event.target.value })}
                />
              </Field>
              <div className="flex gap-2">
                <Button size="sm" onClick={submitBarRegistration} disabled={!barForm.barNumber}>
                  {barForm.id ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                  {barForm.id ? 'Salvar OAB' : 'Adicionar OAB'}
                </Button>
                {barForm.id ? (
                  <Button size="sm" variant="ghost" onClick={() => setBarForm(emptyBarForm())}>
                    Cancelar
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              {barRegistrations.length === 0 ? (
                <EmptyState
                  message="Nenhuma OAB monitorada"
                  description="Cadastre OABs para buscar publicações pelo advogado."
                />
              ) : (
                barRegistrations.map((row) => (
                  <div key={row.id} className="rounded-md border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">
                          {row.barNumber}/{row.stateCode}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {row.lawyerName ?? 'Sem nome informado'}
                        </div>
                      </div>
                      <Badge variant={row.active ? 'success' : 'secondary'} appearance="light">
                        {row.active ? 'Ativa' : 'Pausada'}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                      <span>{fmtNum(row.publicationCount)} publicações</span>
                      <span>
                        {row.latestAvailableAt ? fmtDate(row.latestAvailableAt) : 'Sem captura'}
                      </span>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setBarForm(barFormFrom(row))}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant={row.active ? 'outline' : 'secondary'}
                        disabled={busyId === row.id}
                        onClick={() => toggleBarRegistration(row)}
                      >
                        {row.active ? (
                          <PowerOff className="size-3.5" />
                        ) : (
                          <Power className="size-3.5" />
                        )}
                        {row.active ? 'Pausar' : 'Ativar'}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

type CaseForm = {
  id: string | null
  cnjNumber: string
  label: string
  clientPartySide: string
  monitoredBarRegistrationId: string
}

type BarForm = {
  id: string | null
  barNumber: string
  stateCode: string
  lawyerName: string
}

function Metric({ title, value, icon }: { title: string; value: number; icon: ReactElement }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary [&_svg]:size-5">
          {icon}
        </div>
        <div>
          <div className="text-sm text-muted-foreground">{title}</div>
          <div className="text-2xl font-semibold tabular-nums">{fmtNum(value)}</div>
        </div>
      </CardContent>
    </Card>
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

function emptyCaseForm(): CaseForm {
  return {
    id: null,
    cnjNumber: '',
    label: '',
    clientPartySide: '',
    monitoredBarRegistrationId: '',
  }
}

function emptyBarForm(): BarForm {
  return {
    id: null,
    barNumber: '',
    stateCode: 'SP',
    lawyerName: '',
  }
}

function caseFormFrom(row: MonitoredCaseRow): CaseForm {
  return {
    id: row.id,
    cnjNumber: row.cnjNumber,
    label: row.label ?? '',
    clientPartySide: row.clientPartySide ?? '',
    monitoredBarRegistrationId: row.monitoredBarRegistrationId ?? '',
  }
}

function barFormFrom(row: BarRegistrationRow): BarForm {
  return {
    id: row.id,
    barNumber: row.barNumber,
    stateCode: row.stateCode,
    lawyerName: row.lawyerName ?? '',
  }
}

function nullableText(value: string) {
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function partySideLabel(value: MonitoredCaseRow['clientPartySide']) {
  if (value === 'plaintiff') return 'Autor'
  if (value === 'defendant') return 'Réu'
  return '—'
}
