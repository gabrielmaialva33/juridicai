import { Head, router } from '@inertiajs/react'
import { RotateCw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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

type JobRun = {
  id: string
  jobName: string
  queueName: string
  status: string
  attempt: number
  startedAt?: string | null
  finishedAt?: string | null
  durationMs?: number | null
  errorCode?: string | null
  errorMessage?: string | null
  payload?: Record<string, any> | null
  createdAt: string
}

type Meta = {
  total: number
  perPage: number
  currentPage: number
  lastPage: number
}

type QueueSnapshot = {
  name: string
  active?: number
  waiting?: number
  failed?: number
}

type WorkerFreshness = {
  queue: string
  freshHeartbeats: number
  staleHeartbeats: number
  lastSeenAt?: string | null
}

type Props = {
  runs: JobRun[]
  meta: Meta
  queues: QueueSnapshot[]
  workers: WorkerFreshness[]
}

export default function AdminJobs({ runs, meta, queues }: Props) {
  const [retrying, setRetrying] = useState<string | null>(null)

  function handleRetry(id: string) {
    setRetrying(id)
    router.post(
      `/admin/jobs/${id}/retry`,
      {},
      {
        onFinish: () => setRetrying(null),
        onSuccess: () => router.reload({ only: ['runs', 'meta'] }),
      }
    )
  }

  function goPage(p: number) {
    router.get('/admin/jobs', { page: p }, { preserveState: true })
  }

  const totalActive = queues.reduce((s, q) => s + (q.active ?? 0), 0)
  const totalWaiting = queues.reduce((s, q) => s + (q.waiting ?? 0), 0)
  const totalFailed = queues.reduce((s, q) => s + (q.failed ?? 0), 0)

  return (
    <>
      <Head title="Jobs · Admin" />

      <PageHeader
        title="Jobs"
        description={`${fmtNum(meta.total)} runs registradas — ${fmtNum(totalActive)} ativos, ${fmtNum(totalWaiting)} aguardando, ${fmtNum(totalFailed)} falhas.`}
        breadcrumbs={[{ label: 'Admin' }, { label: 'Jobs' }]}
      />

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Histórico de execuções</h2>
        </CardHeader>
        <CardContent className="p-0">
          {runs.length === 0 ? (
            <EmptyState
              message="Sem runs ainda"
              description="Aguarde a execução do scheduler ou dispare um job manualmente."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Fila</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-end">Tentativa</TableHead>
                    <TableHead className="text-end">Duração</TableHead>
                    <TableHead>Iniciado</TableHead>
                    <TableHead>Erro</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.jobName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.queueName}</TableCell>
                      <TableCell>
                        <StatusBadge kind="job_run" value={r.status} />
                      </TableCell>
                      <TableCell className="text-end tabular-nums text-xs">{r.attempt}</TableCell>
                      <TableCell className="text-end tabular-nums text-xs">
                        {r.durationMs !== null && r.durationMs !== undefined
                          ? formatDuration(r.durationMs)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtRelative(r.startedAt ?? r.createdAt)}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {r.errorCode || r.errorMessage ? (
                          <details className="text-xs">
                            <summary className="text-red-600 dark:text-red-400 cursor-pointer truncate">
                              {r.errorCode ?? 'Erro'}
                            </summary>
                            {r.errorMessage && (
                              <pre className="mt-1 text-[10px] text-muted-foreground whitespace-pre-wrap break-all max-h-32 overflow-auto">
                                {r.errorMessage}
                              </pre>
                            )}
                          </details>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {(r.status === 'failed' || r.status === 'cancelled') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            mode="icon"
                            onClick={() => handleRetry(r.id)}
                            disabled={retrying === r.id}
                            aria-label="Tentar novamente"
                          >
                            <RotateCw
                              className={`size-3.5 ${retrying === r.id ? 'animate-spin' : ''}`}
                            />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {meta.lastPage > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
                  <div className="tabular-nums">
                    Página {meta.currentPage} de {meta.lastPage} · {fmtNum(meta.total)} runs
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={meta.currentPage <= 1}
                      onClick={() => goPage(meta.currentPage - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={meta.currentPage >= meta.lastPage}
                      onClick={() => goPage(meta.currentPage + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}min ${Math.floor((ms % 60_000) / 1000)}s`
}
