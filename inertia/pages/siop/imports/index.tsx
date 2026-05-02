import { Head } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { Database, ExternalLink, FileSpreadsheet, Plus } from 'lucide-react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '~/components/shared/page-header'
import { EmptyState } from '~/components/shared/empty-state'
import { StatusBadge } from '~/components/status-badge'
import { fmtNum, fmtRelative } from '~/lib/helpers'

type Import = {
  id: string
  exerciseYear: number
  status: string
  totalRows: number
  insertedRows?: number
  updatedRows?: number
  invalidRows?: number
  startedAt?: string | null
  finishedAt?: string | null
  createdAt: string
}

type Props = {
  imports: Import[]
  sources: GovernmentSource[]
}

type GovernmentSource = {
  id: string
  key: string
  name: string
  owner?: string | null
  level: string
  priority: string
  status: string
  cadence?: string | null
  courtAlias?: string | null
  stateCode?: string | null
  format?: string | null
  sourceUrl?: string | null
  manualExportUrl?: string | null
  blockedLinks: string[]
  coverageScore?: string | null
  lastSuccessAt?: string | null
  lastErrorAt?: string | null
  lastErrorMessage?: string | null
  lastDiscoveredCount: number
  lastSourceRecordsCount: number
  tenantSourceRecordsCount: number
  tenantLastCollectedAt?: string | null
  adapterKey?: string | null
  lastJobRunAt?: string | null
}

const SiopImportsIndex: FC<Props> = ({ imports, sources }) => {
  return (
    <>
      <Head title="Fontes de Dados" />
      <PageHeader
        title="Fontes de Dados"
        description="Importações oficiais e fluxos assistidos de dados governamentais."
        breadcrumbs={[{ label: 'Fontes de Dados' }]}
      >
        <Button asChild size="sm">
          <Link href="/siop/imports/new">
            <Plus className="me-1 size-3.5" />
            Nova importação
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sources.slice(0, 9).map((source) => (
          <Card key={source.id} className="overflow-hidden">
            <CardHeader className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="truncate text-sm">{source.name}</CardTitle>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{labelForLevel(source.level)}</span>
                    {source.courtAlias && <span>· {source.courtAlias.toUpperCase()}</span>}
                    {source.stateCode && <span>· {source.stateCode}</span>}
                    {source.format && <span>· {source.format}</span>}
                  </div>
                </div>
                <Badge variant={badgeVariantForSource(source.status)}>
                  {labelForSourceStatus(source.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0">
              <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/20 p-3">
                <Metric label="Registros" value={fmtNum(source.tenantSourceRecordsCount)} />
                <Metric label="Descobertos" value={fmtNum(source.lastDiscoveredCount)} />
                <Metric label="Cobertura" value={source.coverageScore ?? '—'} />
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                <div>Última coleta: {fmtRelative(source.tenantLastCollectedAt)}</div>
                <div>Último sucesso: {fmtRelative(source.lastSuccessAt)}</div>
                {source.lastErrorMessage && (
                  <div className="line-clamp-2 text-destructive">{source.lastErrorMessage}</div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {source.manualExportUrl && (
                  <Button asChild size="sm" variant="outline">
                    <a href={source.manualExportUrl} target="_blank" rel="noreferrer">
                      Abrir exportação
                      <ExternalLink className="ms-1 size-3.5" />
                    </a>
                  </Button>
                )}
                {!source.manualExportUrl && source.sourceUrl && (
                  <Button asChild size="sm" variant="outline">
                    <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                      Abrir fonte
                      <ExternalLink className="ms-1 size-3.5" />
                    </a>
                  </Button>
                )}
                {source.key === 'tribunal:trf6-federal-precatorio-orders' && (
                  <Button asChild size="sm">
                    <Link href="/siop/imports/new">Importar CSV</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="p-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Database className="size-4" />
            Histórico de importações SIOP
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {imports.length === 0 ? (
            <EmptyState
              icon={<FileSpreadsheet className="size-12" />}
              message="Nenhum import ainda"
              description="Suba um arquivo oficial para popular a base canônica."
            >
              <Button asChild size="sm">
                <Link href="/siop/imports/new">
                  <Plus className="me-1 size-3.5" />
                  Nova importação
                </Link>
              </Button>
            </EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Exercício</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-end">Linhas totais</TableHead>
                  <TableHead className="text-end">Inseridas</TableHead>
                  <TableHead className="text-end">Inválidas</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.map((imp) => (
                  <TableRow key={imp.id} className="hover:bg-muted/40">
                    <TableCell className="font-mono tabular-nums">{imp.exerciseYear}</TableCell>
                    <TableCell>
                      <StatusBadge kind="import" value={imp.status} />
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{fmtNum(imp.totalRows)}</TableCell>
                    <TableCell className="text-end tabular-nums text-emerald-600 dark:text-emerald-400">
                      {fmtNum(imp.insertedRows ?? 0)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums text-red-600 dark:text-red-400">
                      {fmtNum(imp.invalidRows ?? 0)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtRelative(imp.startedAt)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtRelative(imp.finishedAt)}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/siop/imports/${imp.id}`}>Detalhe</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}

export default SiopImportsIndex

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm tabular-nums text-foreground">{value}</div>
    </div>
  )
}

function labelForLevel(level: string) {
  const labels: Record<string, string> = {
    federal: 'Federal',
    state: 'Estadual',
    municipal: 'Municipal',
    national: 'Nacional',
  }

  return labels[level] ?? level
}

function labelForSourceStatus(status: string) {
  const labels: Record<string, string> = {
    active: 'Ativa',
    pending: 'Pendente',
    blocked: 'Bloqueada',
    degraded: 'Instável',
    retired: 'Inativa',
  }

  return labels[status] ?? status
}

function badgeVariantForSource(status: string) {
  if (status === 'active') return 'success'
  if (status === 'blocked' || status === 'degraded') return 'destructive'
  return 'secondary'
}
