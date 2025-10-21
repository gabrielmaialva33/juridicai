import { router } from '@inertiajs/react'
import { toast } from 'sonner'

/**
 * API Base Configuration
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

/**
 * API Client with automatic error handling and toast notifications
 */
export class ApiClient {
  private baseURL: string

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
  }

  /**
   * Generic fetch wrapper with error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T; error: null } | { data: null; error: string }> {
    try {
      const url = `${this.baseURL}${endpoint}`
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          ...options.headers,
        },
        credentials: 'include', // Include cookies for authentication
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage =
          errorData.message || errorData.error || `Error: ${response.statusText}`
        throw new Error(errorMessage)
      }

      const data = await response.json()
      return { data, error: null }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('API Error:', errorMessage)
      return { data: null, error: errorMessage }
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string): Promise<{ data: T | null; error: string | null }> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: any): Promise<{ data: T | null; error: string | null }> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: any): Promise<{ data: T | null; error: string | null }> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, data?: any): Promise<{ data: T | null; error: string | null }> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string): Promise<{ data: T | null; error: string | null }> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }

  /**
   * Upload file with FormData
   */
  async upload<T>(
    endpoint: string,
    file: File,
    additionalData?: Record<string, any>
  ): Promise<{ data: T | null; error: string | null }> {
    try {
      const formData = new FormData()
      formData.append('file', file)

      if (additionalData) {
        Object.entries(additionalData).forEach(([key, value]) => {
          formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value)
        })
      }

      const url = `${this.baseURL}${endpoint}`
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage =
          errorData.message || errorData.error || `Error: ${response.statusText}`
        throw new Error(errorMessage)
      }

      const data = await response.json()
      return { data, error: null }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      console.error('Upload Error:', errorMessage)
      return { data: null, error: errorMessage }
    }
  }
}

/**
 * Default API client instance
 */
export const api = new ApiClient()

/**
 * Helper functions for common operations with toast notifications
 */
export const apiWithToast = {
  async get<T>(endpoint: string, successMessage?: string) {
    const result = await api.get<T>(endpoint)
    if (result.error) {
      toast.error(result.error)
    } else if (successMessage) {
      toast.success(successMessage)
    }
    return result
  },

  async post<T>(endpoint: string, data?: any, successMessage?: string) {
    const result = await api.post<T>(endpoint, data)
    if (result.error) {
      toast.error(result.error)
    } else if (successMessage) {
      toast.success(successMessage)
    }
    return result
  },

  async put<T>(endpoint: string, data?: any, successMessage?: string) {
    const result = await api.put<T>(endpoint, data)
    if (result.error) {
      toast.error(result.error)
    } else if (successMessage) {
      toast.success(successMessage)
    }
    return result
  },

  async patch<T>(endpoint: string, data?: any, successMessage?: string) {
    const result = await api.patch<T>(endpoint, data)
    if (result.error) {
      toast.error(result.error)
    } else if (successMessage) {
      toast.success(successMessage)
    }
    return result
  },

  async delete<T>(endpoint: string, successMessage?: string) {
    const result = await api.delete<T>(endpoint)
    if (result.error) {
      toast.error(result.error)
    } else if (successMessage) {
      toast.success(successMessage)
    }
    return result
  },
}

/**
 * Inertia form submission helpers with toast
 */
export const inertiaSubmit = {
  post(url: string, data: any, options?: { onSuccess?: () => void; successMessage?: string }) {
    router.post(url, data, {
      preserveScroll: true,
      onSuccess: () => {
        if (options?.successMessage) {
          toast.success(options.successMessage)
        }
        options?.onSuccess?.()
      },
      onError: (errors) => {
        const firstError = Object.values(errors)[0]
        toast.error(firstError || 'Erro ao processar solicitação')
      },
    })
  },

  put(url: string, data: any, options?: { onSuccess?: () => void; successMessage?: string }) {
    router.put(url, data, {
      preserveScroll: true,
      onSuccess: () => {
        if (options?.successMessage) {
          toast.success(options.successMessage)
        }
        options?.onSuccess?.()
      },
      onError: (errors) => {
        const firstError = Object.values(errors)[0]
        toast.error(firstError || 'Erro ao processar solicitação')
      },
    })
  },

  delete(url: string, options?: { onSuccess?: () => void; successMessage?: string }) {
    router.delete(url, {
      preserveScroll: true,
      onSuccess: () => {
        if (options?.successMessage) {
          toast.success(options.successMessage)
        }
        options?.onSuccess?.()
      },
      onError: (errors) => {
        const firstError = Object.values(errors)[0]
        toast.error(firstError || 'Erro ao processar solicitação')
      },
    })
  },
}
