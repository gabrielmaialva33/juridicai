import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, apiWithToast } from '@/lib/api'
import type {
  Document,
  PaginatedResponse,
  DocumentFilters,
  CreateDocumentData,
} from '@/types/api'

/**
 * Query keys for documents
 */
export const documentKeys = {
  all: ['documents'] as const,
  lists: () => [...documentKeys.all, 'list'] as const,
  list: (filters: DocumentFilters) => [...documentKeys.lists(), filters] as const,
  details: () => [...documentKeys.all, 'detail'] as const,
  detail: (id: number) => [...documentKeys.details(), id] as const,
}

/**
 * Fetch paginated list of documents
 */
export function useDocuments(filters: DocumentFilters = {}) {
  const queryString = new URLSearchParams(
    Object.entries(filters)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, String(value)])
  ).toString()

  return useQuery({
    queryKey: documentKeys.list(filters),
    queryFn: async () => {
      const { data, error } = await api.get<PaginatedResponse<Document>>(
        `/documents${queryString ? `?${queryString}` : ''}`
      )
      if (error) throw new Error(error)
      return data!
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Fetch single document by ID
 */
export function useDocument(id: number | null) {
  return useQuery({
    queryKey: documentKeys.detail(id!),
    queryFn: async () => {
      const { data, error} = await api.get<Document>(`/documents/${id}`)
      if (error) throw new Error(error)
      return data!
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Upload new document
 */
export function useUploadDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      file,
      data,
    }: {
      file: File
      data: CreateDocumentData
    }) => {
      const result = await apiWithToast.upload<Document>(
        '/documents',
        file,
        data,
        'Documento enviado com sucesso!'
      )
      if (result.error) throw new Error(result.error)
      return result.data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() })
    },
  })
}

/**
 * Update existing document metadata
 */
export function useUpdateDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number
      data: Partial<CreateDocumentData>
    }) => {
      const result = await apiWithToast.patch<Document>(
        `/documents/${id}`,
        data,
        'Documento atualizado com sucesso!'
      )
      if (result.error) throw new Error(result.error)
      return result.data!
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() })
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(variables.id) })
    },
  })
}

/**
 * Delete document
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      const result = await apiWithToast.delete(
        `/documents/${id}`,
        'Documento removido com sucesso!'
      )
      if (result.error) throw new Error(result.error)
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() })
    },
  })
}

/**
 * Get document download URL
 */
export function getDocumentDownloadUrl(id: number): string {
  return `/api/v1/documents/${id}/download`
}
