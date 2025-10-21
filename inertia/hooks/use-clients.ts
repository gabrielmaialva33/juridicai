import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, apiWithToast } from '@/lib/api'
import type {
  Client,
  PaginatedResponse,
  CreateClientData,
  UpdateClientData,
  ClientFilters,
} from '@/types/api'

/**
 * Query keys for clients
 */
export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: (filters: ClientFilters) => [...clientKeys.lists(), filters] as const,
  details: () => [...clientKeys.all, 'detail'] as const,
  detail: (id: number) => [...clientKeys.details(), id] as const,
}

/**
 * Fetch paginated list of clients
 */
export function useClients(filters: ClientFilters = {}) {
  const queryString = new URLSearchParams(
    Object.entries(filters)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, String(value)])
  ).toString()

  return useQuery({
    queryKey: clientKeys.list(filters),
    queryFn: async () => {
      const { data, error } = await api.get<PaginatedResponse<Client>>(
        `/clients${queryString ? `?${queryString}` : ''}`
      )
      if (error) throw new Error(error)
      return data!
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Fetch single client by ID
 */
export function useClient(id: number | null) {
  return useQuery({
    queryKey: clientKeys.detail(id!),
    queryFn: async () => {
      const { data, error } = await api.get<Client>(`/clients/${id}`)
      if (error) throw new Error(error)
      return data!
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Create new client
 */
export function useCreateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateClientData) => {
      const result = await apiWithToast.post<Client>(
        '/clients',
        data,
        'Cliente criado com sucesso!'
      )
      if (result.error) throw new Error(result.error)
      return result.data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
    },
  })
}

/**
 * Update existing client
 */
export function useUpdateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateClientData }) => {
      const result = await apiWithToast.put<Client>(
        `/clients/${id}`,
        data,
        'Cliente atualizado com sucesso!'
      )
      if (result.error) throw new Error(result.error)
      return result.data!
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(variables.id) })
    },
  })
}

/**
 * Delete client
 */
export function useDeleteClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      const result = await apiWithToast.delete(`/clients/${id}`, 'Cliente removido com sucesso!')
      if (result.error) throw new Error(result.error)
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
    },
  })
}
