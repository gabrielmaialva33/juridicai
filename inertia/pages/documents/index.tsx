import { Head } from '@inertiajs/react'
import { DynamicLayoutWrapper } from '@/layouts/dynamic-layout-wrapper'
import { useState } from 'react'
import { Plus, Search, FileText, Download, Eye } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { useDocuments, getDocumentDownloadUrl } from '@/hooks/use-documents'
import type { DocumentFilters } from '@/types/api'

// UI Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const DOCUMENT_TYPE_LABELS = {
  petition: 'Petição',
  contract: 'Contrato',
  evidence: 'Prova',
  judgment: 'Sentença',
  appeal: 'Recurso',
  power_of_attorney: 'Procuração',
  agreement: 'Acordo',
  report: 'Parecer',
  other: 'Outro',
}

const DOCUMENT_TYPE_COLORS = {
  petition: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  contract: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  evidence: 'bg-green-500/10 text-green-700 dark:text-green-400',
  judgment: 'bg-red-500/10 text-red-700 dark:text-red-400',
  appeal: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  power_of_attorney: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
  agreement: 'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  report: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400',
  other: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
}

const ACCESS_LEVEL_LABELS = {
  tenant: 'Escritório',
  case_team: 'Equipe do Processo',
  owner_only: 'Apenas Proprietário',
}

function Documents() {
  const [filters, setFilters] = useState<DocumentFilters>({
    page: 1,
    per_page: 10,
  })

  const { data: documentsData, isLoading, error } = useDocuments(filters)

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value || undefined, page: 1 }))
  }

  const handleDocumentTypeChange = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      document_type: value === 'all' ? undefined : (value as any),
      page: 1,
    }))
  }

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
  }

  const formatDate = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), {
      addSuffix: true,
      locale: ptBR,
    })
  }

  return (
    <>
      <Head title="Documentos" />

      <div className="p-4 sm:p-5 lg:p-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 backdrop-blur-xl shadow-lg shadow-primary/20 border border-primary/30 text-primary">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Documentos</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gerencie e organize todos os documentos jurídicos
              </p>
            </div>
          </div>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Upload de Documento
          </Button>
        </div>

        {/* Filters Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros</CardTitle>
            <CardDescription>Refine sua busca de documentos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por título, nome do arquivo ou descrição..."
                    className="pl-9"
                    value={filters.search || ''}
                    onChange={(e) => handleSearchChange(e.target.value)}
                  />
                </div>
              </div>

              {/* Document Type Filter */}
              <div>
                <Select
                  value={filters.document_type || 'all'}
                  onValueChange={handleDocumentTypeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de Documento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Tipos</SelectItem>
                    <SelectItem value="petition">Petição</SelectItem>
                    <SelectItem value="contract">Contrato</SelectItem>
                    <SelectItem value="evidence">Prova</SelectItem>
                    <SelectItem value="judgment">Sentença</SelectItem>
                    <SelectItem value="appeal">Recurso</SelectItem>
                    <SelectItem value="power_of_attorney">Procuração</SelectItem>
                    <SelectItem value="agreement">Acordo</SelectItem>
                    <SelectItem value="report">Parecer</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents Table */}
        <Card>
          <CardContent className="p-0">
            {error ? (
              <div className="p-8 text-center">
                <p className="text-destructive">Erro ao carregar documentos: {error.message}</p>
              </div>
            ) : isLoading ? (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">Carregando documentos...</p>
              </div>
            ) : !documentsData?.data.length ? (
              <div className="p-8 text-center">
                <FileText className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum documento encontrado</h3>
                <p className="text-muted-foreground">
                  Comece fazendo upload do primeiro documento clicando no botão acima.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Arquivo</TableHead>
                        <TableHead>Tamanho</TableHead>
                        <TableHead>Acesso</TableHead>
                        <TableHead>Upload</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documentsData.data.map((document) => (
                        <TableRow key={document.id}>
                          <TableCell className="font-medium">
                            <div>
                              <div className="flex items-center gap-2">
                                {document.title}
                                {document.is_signed && (
                                  <Badge variant="outline" className="text-xs">
                                    Assinado
                                  </Badge>
                                )}
                              </div>
                              {document.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {document.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={DOCUMENT_TYPE_COLORS[document.document_type]}>
                              {DOCUMENT_TYPE_LABELS[document.document_type]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{document.original_filename}</TableCell>
                          <TableCell className="text-sm">
                            {formatFileSize(document.file_size)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {ACCESS_LEVEL_LABELS[document.access_level]}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(document.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="Visualizar"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="Download"
                                onClick={() => {
                                  window.open(getDocumentDownloadUrl(document.id), '_blank')
                                }}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {documentsData.meta && documentsData.meta.lastPage > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {documentsData.meta.from} a {documentsData.meta.to} de{' '}
                      {documentsData.meta.total} documentos
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(documentsData.meta!.currentPage - 1)}
                        disabled={documentsData.meta.currentPage === 1}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(documentsData.meta!.currentPage + 1)}
                        disabled={documentsData.meta.currentPage === documentsData.meta.lastPage}
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
      </div>
    </>
  )
}

Documents.layout = (page: React.ReactNode) => <DynamicLayoutWrapper>{page}</DynamicLayoutWrapper>

export default Documents
