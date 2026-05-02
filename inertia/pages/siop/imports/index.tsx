import { Head } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { FileSpreadsheet, Plus } from 'lucide-react'
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
}

export default function SiopImportsIndex({ imports }: Props) {
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

      <Card>
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
