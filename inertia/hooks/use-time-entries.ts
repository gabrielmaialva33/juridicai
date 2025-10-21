import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, apiWithToast } from '@/lib/api'
import type {
  TimeEntry,
  PaginatedResponse,
  TimeEntryFilters,
  CreateTimeEntryData,
  UpdateTimeEntryData,
} from '@/types/api'

/**
 * Query keys for time entries
 */
export const timeEntryKeys = {
  all: ['timeEntries'] as const,
  lists: () => [...timeEntryKeys.all, 'list'] as const,
  list: (filters: TimeEntryFilters) => [...timeEntryKeys.lists(), filters] as const,
  stats: () => [...timeEntryKeys.all, 'stats'] as const,
  running: () => [...timeEntryKeys.all, 'running'] as const,
}

/**
 * Fetch paginated list of time entries
 */
export function useTimeEntries(filters: TimeEntryFilters = {}) {
  const queryString = new URLSearchParams(
    Object.entries(filters)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, String(value)])
  ).toString()

  return useQuery({
    queryKey: timeEntryKeys.list(filters),
    queryFn: async () => {
      const { data, error } = await api.get<PaginatedResponse<TimeEntry>>(
        `/time-entries${queryString ? `?${queryString}` : ''}`
      )
      if (error) throw new Error(error)
      return data!
    },
    staleTime: 1000 * 30, // 30 seconds (time entries need fresher data)
  })
}

/**
 * Fetch time entry statistics
 */
export function useTimeEntryStats(filters: Omit<TimeEntryFilters, 'page' | 'per_page'> = {}) {
  const queryString = new URLSearchParams(
    Object.entries(filters)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, String(value)])
  ).toString()

  return useQuery({
    queryKey: [...timeEntryKeys.stats(), filters],
    queryFn: async () => {
      const { data, error } = await api.get<{
        total_hours: number
        billable_hours: number
        total_amount: string
        entries_count: number
      }>(`/time-entries/stats${queryString ? `?${queryString}` : ''}`)
      if (error) throw new Error(error)
      return data!
    },
    staleTime: 1000 * 60, // 1 minute
  })
}

/**
 * Start timer for new time entry
 */
export function useStartTimer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { case_id?: number; description: string }) => {
      const result = await apiWithToast.post<TimeEntry>(
        '/time-entries/start',
        data,
        'Timer iniciado!'
      )
      if (result.error) throw new Error(result.error)
      return result.data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timeEntryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: timeEntryKeys.running() })
    },
  })
}

/**
 * Stop running timer
 */
export function useStopTimer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      const result = await apiWithToast.post<TimeEntry>(
        `/time-entries/${id}/stop`,
        {},
        'Timer parado!'
      )
      if (result.error) throw new Error(result.error)
      return result.data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timeEntryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: timeEntryKeys.running() })
      queryClient.invalidateQueries({ queryKey: timeEntryKeys.stats() })
    },
  })
}

/**
 * Create manual time entry
 */
export function useCreateTimeEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateTimeEntryData) => {
      const result = await apiWithToast.post<TimeEntry>(
        '/time-entries',
        data,
        'Lançamento criado com sucesso!'
      )
      if (result.error) throw new Error(result.error)
      return result.data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timeEntryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: timeEntryKeys.stats() })
    },
  })
}

/**
 * Update existing time entry
 */
export function useUpdateTimeEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateTimeEntryData }) => {
      const result = await apiWithToast.patch<TimeEntry>(
        `/time-entries/${id}`,
        data,
        'Lançamento atualizado com sucesso!'
      )
      if (result.error) throw new Error(result.error)
      return result.data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timeEntryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: timeEntryKeys.stats() })
    },
  })
}

/**
 * Delete time entry
 */
export function useDeleteTimeEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      const result = await apiWithToast.delete(
        `/time-entries/${id}`,
        'Lançamento removido com sucesso!'
      )
      if (result.error) throw new Error(result.error)
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timeEntryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: timeEntryKeys.stats() })
    },
  })
}
