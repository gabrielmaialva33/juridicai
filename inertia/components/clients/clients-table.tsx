import { Link } from '@inertiajs/react'
import { MoreHorizontal, Edit, Trash2, Eye, Building2, User, Phone, Mail } from 'lucide-react'
import type { Client, PaginationMeta } from '@/types/api'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { useDeleteClient } from '@/hooks/use-clients'
import { useState } from 'react'

interface ClientsTableProps {
  data: Client[]
  meta?: PaginationMeta
  isLoading: boolean
  onPageChange: (page: number) => void
}

export function ClientsTable({ data, meta, isLoading, onPageChange }: ClientsTableProps) {
  const deleteClient = useDeleteClient()
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Tem certeza que deseja remover o cliente "${name}"?`)) return

    setDeletingId(id)
    try {
      await deleteClient.mutateAsync(id)
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading && !data.length) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-muted-foreground">Carregando clientes...</p>
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="p-8 text-center">
        <User className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">Nenhum cliente encontrado.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Comece criando um novo cliente usando o botão acima.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>CPF/CNPJ</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Processos</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((client) => (
              <TableRow key={client.id} className={deletingId === client.id ? 'opacity-50' : ''}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                      {client.client_type === 'company' ? (
                        <Building2 className="w-5 h-5 text-primary" />
                      ) : (
                        <User className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <Link
                        href={`/clients/${client.id}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {client.display_name || client.full_name || client.company_name}
                      </Link>
                      {client.tags && client.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {client.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {client.tags.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{client.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={client.client_type === 'company' ? 'default' : 'secondary'}>
                    {client.client_type === 'company' ? 'PJ' : 'PF'}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">{client.tax_id || '—'}</TableCell>
                <TableCell>
                  <div className="space-y-1 text-sm">
                    {client.email && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[200px]">{client.email}</span>
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{client.cases_count || 0} processos</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <span className="sr-only">Abrir menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Ações</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href={`/clients/${client.id}`} className="cursor-pointer">
                          <Eye className="mr-2 h-4 w-4" />
                          Visualizar
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/clients/${client.id}/edit`} className="cursor-pointer">
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() =>
                          handleDelete(
                            client.id,
                            client.display_name || client.full_name || client.company_name || ''
                          )
                        }
                        disabled={deletingId === client.id}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {deletingId === client.id ? 'Removendo...' : 'Remover'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {meta && meta.lastPage > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t">
          <div className="text-sm text-muted-foreground">
            Mostrando {(meta.currentPage - 1) * meta.perPage + 1} até{' '}
            {Math.min(meta.currentPage * meta.perPage, meta.total)} de {meta.total} clientes
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(meta.currentPage - 1)}
              disabled={meta.currentPage === 1 || isLoading}
            >
              Anterior
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, meta.lastPage) }, (_, i) => {
                const pageNum = meta.currentPage <= 3 ? i + 1 : meta.currentPage - 2 + i
                if (pageNum > meta.lastPage) return null
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === meta.currentPage ? 'default' : 'outline'}
                    size="sm"
                    className="w-10"
                    onClick={() => onPageChange(pageNum)}
                    disabled={isLoading}
                  >
                    {pageNum}
                  </Button>
                )
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(meta.currentPage + 1)}
              disabled={meta.currentPage === meta.lastPage || isLoading}
            >
              Próximo
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
