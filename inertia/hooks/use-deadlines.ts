import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, apiWithToast } from '@/lib/api'
import type {
  Deadline,
  PaginatedResponse,
  DeadlineFilters,
  CreateDeadlineData,
  UpdateDeadlineData,
} from '@/types/api'

/**
 * Query keys for deadlines
 */
export const deadlineKeys = {
  all: ['deadlines'] as const,
  lists: () => [...deadlineKeys.all, 'list'] as const,
  list: (filters: DeadlineFilters) => [...deadlineKeys.lists(), filters] as const,
  upcoming: () => [...deadlineKeys.all, 'upcoming'] as const,
  details: () => [...deadlineKeys.all, 'detail'] as const,
  detail: (id: number) => [...deadlineKeys.details(), id] as const,
}

/**
 * Fetch paginated list of deadlines
 */
export function useDeadlines(filters: DeadlineFilters = {}) {
  const queryString = new URLSearchParams(
    Object.entries(filters)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, String(value)])
  ).toString()

  return useQuery({
    queryKey: deadlineKeys.list(filters),
    queryFn: async () => {
      const { data, error } = await api.get<PaginatedResponse<Deadline>>(
        `/deadlines${queryString ? `?${queryString}` : ''}`
      )
      if (error) throw new Error(error)
      return data!
    },
    staleTime: 1000 * 60, // 1 minute (deadlines need fresher data)
  })
}

/**
 * Fetch upcoming deadlines
 */
export function useUpcomingDeadlines(days: number = 7) {
  return useQuery({
    queryKey: [...deadlineKeys.upcoming(), days],
    queryFn: async () => {
      const { data, error } = await api.get<Deadline[]>(`/deadlines/upcoming?days=${days}`)
      if (error) throw new Error(error)
      return data!
    },
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
  })
}

/**
 * Fetch single deadline by ID
 */
export function useDeadline(id: number | null) {
  return useQuery({
    queryKey: deadlineKeys.detail(id!),
    queryFn: async () => {
      const { data, error } = await api.get<Deadline>(`/deadlines/${id}`)
      if (error) throw new Error(error)
      return data!
    },
    enabled: !!id,
    staleTime: 1000 * 60,
  })
}

/**
 * Create new deadline
 */
export function useCreateDeadline() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateDeadlineData) => {
      const result = await apiWithToast.post<Deadline>(
        '/deadlines',
        data,
        'Prazo criado com sucesso!'
      )
      if (result.error) throw new Error(result.error)
      return result.data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deadlineKeys.lists() })
      queryClient.invalidateQueries({ queryKey: deadlineKeys.upcoming() })
    },
  })
}

/**
 * Update existing deadline
 */
export function useUpdateDeadline() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateDeadlineData }) => {
      const result = await apiWithToast.put<Deadline>(
        `/deadlines/${id}`,
        data,
        'Prazo atualizado com sucesso!'
      )
      if (result.error) throw new Error(result.error)
      return result.data!
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: deadlineKeys.lists() })
      queryClient.invalidateQueries({ queryKey: deadlineKeys.upcoming() })
      queryClient.invalidateQueries({ queryKey: deadlineKeys.detail(variables.id) })
    },
  })
}

/**
 * Mark deadline as complete
 */
export function useCompleteDeadline() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      const result = await apiWithToast.patch<Deadline>(
        `/deadlines/${id}/complete`,
        {},
        'Prazo marcado como completo!'
      )
      if (result.error) throw new Error(result.error)
      return result.data!
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: deadlineKeys.lists() })
      queryClient.invalidateQueries({ queryKey: deadlineKeys.upcoming() })
      queryClient.invalidateQueries({ queryKey: deadlineKeys.detail(id) })
    },
  })
}

/**
 * Delete deadline
 */
export function useDeleteDeadline() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      const result = await apiWithToast.delete(`/deadlines/${id}`, 'Prazo removido com sucesso!')
      if (result.error) throw new Error(result.error)
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deadlineKeys.lists() })
      queryClient.invalidateQueries({ queryKey: deadlineKeys.upcoming() })
    },
  })
}
