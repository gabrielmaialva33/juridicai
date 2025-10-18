import { usePage } from '@inertiajs/react'

/**
 * Base interface for Inertia page props
 * Matches @inertiajs/core PageProps interface
 */
export interface InertiaPageProps {
  [key: string]: unknown
}

/**
 * Shared props that are available on all pages via Inertia
 * These are typically set in the HandleInertiaRequestsMiddleware
 */
export interface SharedProps extends InertiaPageProps {
  auth?: {
    user: {
      id: number
      email: string
      full_name: string
      tenant_id?: string
      created_at: string
      updated_at: string
    } | null
  }
  flash?: {
    message?: string
    error?: string
    success?: string
    warning?: string
    info?: string
  }
  errors?: Record<string, string>
  tenant?: {
    id: string
    name: string
    subdomain: string
    created_at: string
    updated_at: string
  } | null
}

/**
 * Type-safe wrapper around Inertia's usePage() hook
 *
 * Usage:
 * ```typescript
 * interface MyPageProps extends SharedProps {
 *   clients: Client[]
 *   stats: { total: number }
 * }
 *
 * function MyPage() {
 *   const { props } = useTypedPage<MyPageProps>()
 *   // props.clients is typed correctly
 *   // props.auth.user is available with autocomplete
 * }
 * ```
 *
 * @template TPageProps - Page-specific props merged with SharedProps
 * @returns Typed Inertia page object with props, url, component, and version
 */
export function useTypedPage<TPageProps extends SharedProps = SharedProps>() {
  return usePage<TPageProps>()
}
