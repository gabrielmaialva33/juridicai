import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, apiWithToast } from '@/lib/api'
import type { CaseEvent, PaginatedResponse } from '@/types/api'

interface CaseEventFilters {
  case_id?: number
  event_type?: string
  source?: string
  start_date?: string
  end_date?: string
  page?: number
  per_page?: number
}

interface CreateCaseEventData {
  case_id: number
  event_type: string
  title: string
  description?: string
  event_date: string
  source?: string
  metadata?: Record<string, any>
}

type UpdateCaseEventData = Partial<CreateCaseEventData>

/**
 * Query keys for case events
 */
export const caseEventKeys = {
  all: ['caseEvents'] as const,
  lists: () => [...caseEventKeys.all, 'list'] as const,
  list: (filters: CaseEventFilters) => [...caseEventKeys.lists(), filters] as const,
  byCase: (caseId: number) => [...caseEventKeys.all, 'case', caseId] as const,
  details: () => [...caseEventKeys.all, 'detail'] as const,
  detail: (id: number) => [...caseEventKeys.details(), id] as const,
}

/**
 * Fetch paginated list of case events
 */
export function useCaseEvents(filters: CaseEventFilters = {}) {
  const queryString = new URLSearchParams(
    Object.entries(filters)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, String(value)])
  ).toString()

  return useQuery({
    queryKey: caseEventKeys.list(filters),
    queryFn: async () => {
      const { data, error } = await api.get<PaginatedResponse<CaseEvent>>(
        `/case-events${queryString ? `?${queryString}` : ''}`
      )
      if (error) throw new Error(error)
      return data!
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}

/**
 * Fetch events for a specific case (for timeline)
 */
export function useCaseTimeline(caseId: number | null) {
  return useQuery({
    queryKey: caseEventKeys.byCase(caseId!),
    queryFn: async () => {
      const { data, error } = await api.get<CaseEvent[]>(`/case-events?case_id=${caseId}`)
      if (error) throw new Error(error)
      return data!
    },
    enabled: !!caseId,
    staleTime: 1000 * 60, // 1 minute
  })
}

/**
 * Fetch single case event by ID
 */
export function useCaseEvent(id: number | null) {
  return useQuery({
    queryKey: caseEventKeys.detail(id!),
    queryFn: async () => {
      const { data, error } = await api.get<CaseEvent>(`/case-events/${id}`)
      if (error) throw new Error(error)
      return data!
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  })
}

/**
 * Create new case event
 */
export function useCreateCaseEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateCaseEventData) => {
      const result = await apiWithToast.post<CaseEvent>(
        '/case-events',
        data,
        'Evento criado com sucesso!'
      )
      if (result.error) throw new Error(result.error)
      return result.data!
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: caseEventKeys.lists() })
      if (data.case_id) {
        queryClient.invalidateQueries({ queryKey: caseEventKeys.byCase(data.case_id) })
      }
    },
  })
}

/**
 * Update existing case event
 */
export function useUpdateCaseEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateCaseEventData }) => {
      const result = await apiWithToast.patch<CaseEvent>(
        `/case-events/${id}`,
        data,
        'Evento atualizado com sucesso!'
      )
      if (result.error) throw new Error(result.error)
      return result.data!
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: caseEventKeys.lists() })
      queryClient.invalidateQueries({ queryKey: caseEventKeys.detail(variables.id) })
      if (data.case_id) {
        queryClient.invalidateQueries({ queryKey: caseEventKeys.byCase(data.case_id) })
      }
    },
  })
}

/**
 * Delete case event
 */
export function useDeleteCaseEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, caseId }: { id: number; caseId?: number }) => {
      const result = await apiWithToast.delete(`/case-events/${id}`, 'Evento removido com sucesso!')
      if (result.error) throw new Error(result.error)
      return { data: result.data, caseId }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: caseEventKeys.lists() })
      if (result.caseId) {
        queryClient.invalidateQueries({ queryKey: caseEventKeys.byCase(result.caseId) })
      }
    },
  })
}
