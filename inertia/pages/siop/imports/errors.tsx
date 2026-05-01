import { Head, router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { fmtNum, fmtRelative } from '~/lib/helpers'

type SiopImport = {
  id: string
  exerciseYear: number
  status: string
  invalidRows?: number
}

type StagingRow = {
  id: string
  rowNumber?: number
  rawData?: Record<string, any> | null
  errors?: Record<string, any> | null
  createdAt: string
}

type Pagination = {
  data: StagingRow[]
  meta: {
    total: number
    perPage: number
    currentPage: number
    lastPage: number
  }
}

type Props = {
  import: SiopImport
  rows: Pagination
}

export default function SiopImportErrors({ import: imp, rows }: Props) {
  const goPage = (p: number) => router.get(`/siop/imports/${imp.id}/errors`, { page: p })

  return (
    <>
      <Head title={`Erros — Import ${imp.exerciseYear}`} />

      <PageHeader
        title={`Linhas inválidas — Import ${imp.exerciseYear}`}
        description={`${fmtNum(rows.meta.total)} linhas com erros de validação detectadas durante o processamento.`}
        breadcrumbs={[
          { label: 'Imports SIOP', href: '/siop/imports' },
          { label: `#${imp.id.slice(0, 8)}`, href: `/siop/imports/${imp.id}` },
          { label: 'Erros' },
        ]}
      >
        <Button variant="outline" size="sm" asChild>
          <Link href={`/siop/imports/${imp.id}`}>
            <ArrowLeft className="me-1 size-3.5" />
            Voltar pro import
          </Link>
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          {rows.data.length === 0 ? (
            <EmptyState
              message="Sem linhas inválidas"
              description="Todas as linhas passaram na validação."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Linha</TableHead>
                    <TableHead>Erros</TableHead>
                    <TableHead>Dados originais</TableHead>
                    <TableHead className="w-[120px] text-end">Criado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.data.map((r) => (
                    <TableRow key={r.id} className="align-top">
                      <TableCell className="font-mono tabular-nums text-xs text-muted-foreground">
                        L{r.rowNumber ?? '—'}
                      </TableCell>
                      <TableCell>
                        <pre className="text-xs whitespace-pre-wrap break-all bg-destructive/5 text-destructive border border-destructive/20 rounded px-2 py-1.5 max-w-xl">
                          {JSON.stringify(r.errors ?? {}, null, 2)}
                        </pre>
                      </TableCell>
                      <TableCell>
                        <details className="text-xs cursor-pointer">
                          <summary className="text-muted-foreground hover:text-foreground">
                            Ver dados ({Object.keys(r.rawData ?? {}).length} campos)
                          </summary>
                          <pre className="mt-1.5 whitespace-pre-wrap break-all bg-muted text-foreground rounded px-2 py-1.5 max-w-xl max-h-48 overflow-auto">
                            {JSON.stringify(r.rawData ?? {}, null, 2)}
                          </pre>
                        </details>
                      </TableCell>
                      <TableCell className="text-end text-xs text-muted-foreground">
                        {fmtRelative(r.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {rows.meta.lastPage > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                  <div className="text-xs text-muted-foreground tabular-nums">
                    Página {rows.meta.currentPage} de {rows.meta.lastPage} ·{' '}
                    {fmtNum(rows.meta.total)} no total
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={rows.meta.currentPage <= 1}
                      onClick={() => goPage(rows.meta.currentPage - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={rows.meta.currentPage >= rows.meta.lastPage}
                      onClick={() => goPage(rows.meta.currentPage + 1)}
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
