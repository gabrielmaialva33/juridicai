import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, apiWithToast } from '@/lib/api'
import type {
  Case,
  PaginatedResponse,
  CaseFilters,
  CreateCaseData,
  UpdateCaseData,
} from '@/types/api'

/**
 * Query keys for cases
 */
export const caseKeys = {
  all: ['cases'] as const,
  lists: () => [...caseKeys.all, 'list'] as const,
  list: (filters: CaseFilters) => [...caseKeys.lists(), filters] as const,
  details: () => [...caseKeys.all, 'detail'] as const,
  detail: (id: number) => [...caseKeys.details(), id] as const,
}

/**
 * Fetch paginated list of cases
 */
export function useCases(filters: CaseFilters = {}) {
  const queryString = new URLSearchParams(
    Object.entries(filters)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, String(value)])
  ).toString()

  return useQuery({
    queryKey: caseKeys.list(filters),
    queryFn: async () => {
      const { data, error } = await api.get<PaginatedResponse<Case>>(
        `/cases${queryString ? `?${queryString}` : ''}`
      )
      if (error) throw new Error(error)
      return data!
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Fetch single case by ID
 */
export function useCase(id: number | null) {
  return useQuery({
    queryKey: caseKeys.detail(id!),
    queryFn: async () => {
      const { data, error } = await api.get<Case>(`/cases/${id}`)
      if (error) throw new Error(error)
      return data!
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Create new case
 */
export function useCreateCase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateCaseData) => {
      const result = await apiWithToast.post<Case>('/cases', data, 'Processo criado com sucesso!')
      if (result.error) throw new Error(result.error)
      return result.data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.lists() })
    },
  })
}

/**
 * Update existing case
 */
export function useUpdateCase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateCaseData }) => {
      const result = await apiWithToast.put<Case>(
        `/cases/${id}`,
        data,
        'Processo atualizado com sucesso!'
      )
      if (result.error) throw new Error(result.error)
      return result.data!
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: caseKeys.lists() })
      queryClient.invalidateQueries({ queryKey: caseKeys.detail(variables.id) })
    },
  })
}

/**
 * Delete case
 */
export function useDeleteCase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      const result = await apiWithToast.delete(`/cases/${id}`, 'Processo removido com sucesso!')
      if (result.error) throw new Error(result.error)
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.lists() })
    },
  })
}
