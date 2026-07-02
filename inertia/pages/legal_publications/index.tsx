import { Head } from '@inertiajs/react'
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

type Props = {
  publications: LegalPublicationRow[]
}

export default function LegalPublicationsIndex({ publications }: Props) {
  return (
    <>
      <Head title="Publicações jurídicas" />

      <PageHeader
        title="Publicações jurídicas"
        description="Publicações DJEN ligadas a processos monitorados e ativos de precatório."
      />

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
