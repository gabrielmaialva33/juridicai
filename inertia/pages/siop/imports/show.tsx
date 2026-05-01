import { useEffect, useState } from 'react'
import { Head, router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { AlertCircle, ArrowLeft, CheckCircle2, Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { PageHeader } from '~/components/shared/page-header'
import { StatusBadge } from '~/components/status-badge'
import { fmtNum, fmtRelative } from '~/lib/helpers'

type SiopImport = {
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
  sourceRecord?: {
    originalFilename?: string | null
    fileSizeBytes?: string | number | null
    sourceChecksum?: string | null
  }
}

type StagingError = {
  id: string
  rowNumber?: number
  errors?: Record<string, any> | null
  createdAt: string
}

type Props = {
  import: SiopImport
  invalidRows: StagingError[]
}

const TERMINAL_STATUSES = new Set(['completed', 'partial', 'failed'])

export default function SiopImportShow({ import: imp, invalidRows: errors }: Props) {
  const isProcessing = !TERMINAL_STATUSES.has(imp.status)
  const [reprocessing, setReprocessing] = useState(false)

  // Polling: enquanto status não-terminal, recarrega props a cada 3s
  useEffect(() => {
    if (!isProcessing) return
    const id = setInterval(() => {
      if (document.hidden) return
      router.reload({ only: ['import', 'invalidRows'] })
    }, 3000)
    return () => clearInterval(id)
  }, [isProcessing])

  const inserted = imp.insertedRows ?? 0
  const updated = imp.updatedRows ?? 0
  const invalid = imp.invalidRows ?? 0
  const processed = inserted + updated + invalid
  const total = Math.max(imp.totalRows, processed)
  const pct = total > 0 ? Math.min(100, (processed / total) * 100) : 0

  function handleReprocess() {
    if (reprocessing) return
    setReprocessing(true)
    router.post(`/siop/imports/${imp.id}/reprocess`, {}, { onFinish: () => setReprocessing(false) })
  }

  return (
    <>
      <Head title={`Import #${imp.id.slice(0, 8)}`} />

      <PageHeader
        title={`Import ${imp.exerciseYear}`}
        description={
          imp.sourceRecord?.originalFilename
            ? `Arquivo: ${imp.sourceRecord.originalFilename}`
            : 'Detalhe da importação SIOP.'
        }
        breadcrumbs={[
          { label: 'Imports SIOP', href: '/siop/imports' },
          { label: `#${imp.id.slice(0, 8)}` },
        ]}
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/siop/imports">
            <ArrowLeft className="me-1 size-3.5" />
            Voltar
          </Link>
        </Button>
        {imp.sourceRecord?.sourceChecksum && (
          <Button variant="outline" size="sm" asChild>
            <a href={`/siop/imports/${imp.id}/download-source`}>
              <Download className="me-1 size-3.5" />
              Baixar fonte
            </a>
          </Button>
        )}
        {(imp.status === 'failed' || imp.status === 'partial') && (
          <Button size="sm" onClick={handleReprocess} disabled={reprocessing}>
            <RefreshCw className={`me-1 size-3.5 ${reprocessing ? 'animate-spin' : ''}`} />
            Reprocessar
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Status</h2>
              <StatusBadge kind="import" value={imp.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isProcessing && (
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="tabular-nums font-medium">{pct.toFixed(1)}%</span>
                </div>
                <Progress value={pct} />
                <div className="text-xs text-muted-foreground mt-2 tabular-nums">
                  {fmtNum(processed)} de {fmtNum(total)} linhas processadas
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Stat label="Total" value={fmtNum(imp.totalRows)} />
              <Stat label="Inseridas" value={fmtNum(inserted)} accent="success" />
              <Stat label="Atualizadas" value={fmtNum(updated)} accent="info" />
              <Stat label="Inválidas" value={fmtNum(invalid)} accent="destructive" />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground border-t border-border pt-4">
              <div>
                <div className="font-medium text-foreground mb-0.5">Iniciado</div>
                {fmtRelative(imp.startedAt)}
              </div>
              <div>
                <div className="font-medium text-foreground mb-0.5">Finalizado</div>
                {fmtRelative(imp.finishedAt)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Resumo do arquivo</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <SummaryRow label="Arquivo" value={imp.sourceRecord?.originalFilename ?? '—'} mono />
            <SummaryRow
              label="Tamanho"
              value={
                imp.sourceRecord?.fileSizeBytes
                  ? `${(Number(imp.sourceRecord.fileSizeBytes) / 1024 / 1024).toFixed(2)} MB`
                  : '—'
              }
            />
            <SummaryRow
              label="Checksum"
              value={
                imp.sourceRecord?.sourceChecksum
                  ? imp.sourceRecord.sourceChecksum.slice(0, 12) + '…'
                  : '—'
              }
              mono
            />
            <SummaryRow label="Criado" value={fmtRelative(imp.createdAt)} />
          </CardContent>
        </Card>
      </div>

      {invalid > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 text-destructive" />
                <h2 className="text-base font-semibold">{fmtNum(invalid)} linhas inválidas</h2>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/siop/imports/${imp.id}/errors`}>Ver todas</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {errors.slice(0, 10).map((err) => (
                <li key={err.id} className="px-5 py-3 text-sm flex items-start gap-3">
                  <span className="text-xs font-mono text-muted-foreground tabular-nums shrink-0 w-12">
                    L{err.rowNumber ?? '—'}
                  </span>
                  <pre className="text-xs flex-1 overflow-hidden whitespace-pre-wrap break-all">
                    {JSON.stringify(err.errors ?? {}, null, 0)}
                  </pre>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {imp.status === 'completed' && invalid === 0 && (
        <Card className="mt-4 border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-5 flex items-center gap-3">
            <CheckCircle2 className="size-6 text-emerald-600" />
            <div>
              <div className="font-medium text-sm">Import concluído sem erros</div>
              <div className="text-xs text-muted-foreground">
                {fmtNum(inserted)} linhas inseridas e {fmtNum(updated)} atualizadas.
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'success' | 'info' | 'destructive'
}) {
  const colorClass =
    accent === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : accent === 'info'
        ? 'text-violet-600 dark:text-violet-400'
        : accent === 'destructive'
          ? 'text-red-600 dark:text-red-400'
          : 'text-foreground'

  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold tabular-nums mt-1 ${colorClass}`}>{value}</div>
    </div>
  )
}

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`text-sm tabular-nums truncate text-end ${mono ? 'font-mono text-xs' : 'font-medium'}`}
      >
        {value}
      </span>
    </div>
  )
}
