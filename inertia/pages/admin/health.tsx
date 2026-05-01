import { Head } from '@inertiajs/react'
import { CheckCircle2, Database, Server, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '~/components/shared/page-header'
import { fmtNum, fmtRelative } from '~/lib/helpers'

type CheckBase = { status: 'ok' | 'failed'; message?: string }

type QueueSnapshot = {
  name: string
  waiting?: number
  active?: number
  completed?: number
  failed?: number
  delayed?: number
  paused?: number
}

type WorkerFreshness = {
  queue: string
  freshHeartbeats: number
  staleHeartbeats: number
  lastSeenAt?: string | null
}

type Checks = {
  database: CheckBase
  queues: CheckBase & { snapshots?: QueueSnapshot[] }
  workers: WorkerFreshness[]
}

type Props = {
  status: 'ok' | 'degraded'
  checks: Checks
}

export default function AdminHealth({ status, checks }: Props) {
  const dbOk = checks.database.status === 'ok'
  const queuesOk = checks.queues.status === 'ok'
  const overall = status === 'ok'

  return (
    <>
      <Head title="Health · Admin" />

      <PageHeader
        title="Health"
        description="Estado dos componentes operacionais do radar."
        breadcrumbs={[{ label: 'Admin' }, { label: 'Health' }]}
      >
        <Badge variant={overall ? 'success' : 'warning'} appearance="light">
          {overall ? 'Operacional' : 'Degradado'}
        </Badge>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ServiceCard
          name="Banco de dados"
          icon={<Database className="size-5" />}
          status={dbOk ? 'ok' : 'failed'}
          message={!dbOk ? checks.database.message : 'Conexão Postgres saudável.'}
        />
        <ServiceCard
          name="Filas (BullMQ)"
          icon={<Server className="size-5" />}
          status={queuesOk ? 'ok' : 'failed'}
          message={!queuesOk ? checks.queues.message : 'Workers respondem normalmente.'}
        />
      </div>

      {checks.queues.snapshots && checks.queues.snapshots.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <h2 className="text-base font-semibold">Snapshots das filas</h2>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="text-start px-5 py-2 font-medium">Fila</th>
                    <th className="text-end px-5 py-2 font-medium">Active</th>
                    <th className="text-end px-5 py-2 font-medium">Waiting</th>
                    <th className="text-end px-5 py-2 font-medium">Delayed</th>
                    <th className="text-end px-5 py-2 font-medium">Completed</th>
                    <th className="text-end px-5 py-2 font-medium">Failed</th>
                    <th className="text-end px-5 py-2 font-medium">Paused</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {checks.queues.snapshots.map((q) => (
                    <tr key={q.name}>
                      <td className="px-5 py-3 font-mono text-xs">{q.name}</td>
                      <td className="text-end px-5 py-3 tabular-nums">{fmtNum(q.active ?? 0)}</td>
                      <td className="text-end px-5 py-3 tabular-nums text-muted-foreground">
                        {fmtNum(q.waiting ?? 0)}
                      </td>
                      <td className="text-end px-5 py-3 tabular-nums text-muted-foreground">
                        {fmtNum(q.delayed ?? 0)}
                      </td>
                      <td className="text-end px-5 py-3 tabular-nums text-emerald-600 dark:text-emerald-400">
                        {fmtNum(q.completed ?? 0)}
                      </td>
                      <td className="text-end px-5 py-3 tabular-nums text-red-600 dark:text-red-400">
                        {fmtNum(q.failed ?? 0)}
                      </td>
                      <td className="text-end px-5 py-3 tabular-nums text-muted-foreground">
                        {fmtNum(q.paused ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Workers</h2>
        </CardHeader>
        <CardContent className="p-0">
          {!checks.workers || checks.workers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum worker registrado.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {checks.workers.map((w) => {
                const healthy = w.freshHeartbeats > 0
                return (
                  <li key={w.queue} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {healthy ? (
                        <CheckCircle2 className="size-4 text-emerald-600" />
                      ) : (
                        <XCircle className="size-4 text-red-600" />
                      )}
                      <span className="font-mono text-sm">{w.queue}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {w.freshHeartbeats} fresh
                      </span>
                      {w.staleHeartbeats > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 tabular-nums">
                          {w.staleHeartbeats} stale
                        </span>
                      )}
                      <span className="text-muted-foreground tabular-nums">
                        {w.lastSeenAt ? `último ${fmtRelative(w.lastSeenAt)}` : '—'}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function ServiceCard({
  name,
  icon,
  status,
  message,
}: {
  name: string
  icon: React.ReactNode
  status: 'ok' | 'failed'
  message?: string
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-start gap-3">
        <div
          className={`flex items-center justify-center size-10 rounded-md shrink-0 ${
            status === 'ok'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-500/10 text-red-600 dark:text-red-400'
          }`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{name}</span>
            <Badge
              variant={status === 'ok' ? 'success' : 'destructive'}
              appearance="light"
              size="sm"
            >
              {status === 'ok' ? 'OK' : 'Falha'}
            </Badge>
          </div>
          {message && <p className="text-xs text-muted-foreground mt-1">{message}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
