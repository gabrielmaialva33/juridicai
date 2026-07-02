import { Head } from '@inertiajs/react'
import { AlertTriangle, CalendarDays, Clock3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
  manualReviewRequired: boolean
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
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {publication.body}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground md:text-right">
                      <div>
                        {publication.availableAt ? fmtDate(publication.availableAt) : 'Sem data'}
                      </div>
                      {publication.dueAt ? <div>Prazo: {fmtDate(publication.dueAt)}</div> : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  )
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
