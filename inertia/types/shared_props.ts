/**
 * Shared TypeScript types for component props across the JuridicAI application.
 * These types define the structure of data passed from AdonisJS backend to Inertia React components.
 *
 * @module shared-props
 */

import { ReactNode } from 'react'

/**
 * User metadata structure stored in JSONB column
 */
export interface UserMetadata {
  email_verified: boolean
  email_verification_token: string | null
  email_verification_sent_at: string | null
  email_verified_at: string | null
}

/**
 * User role slugs matching backend role system
 */
export type RoleSlug = 'root' | 'admin' | 'user' | 'guest' | 'editor'

/**
 * Role object structure
 */
export interface Role {
  id: number
  name: string
  description: string | null
  slug: RoleSlug
  created_at: string
  updated_at: string
}

/**
 * Permission object structure
 */
export interface Permission {
  id: number
  name: string
  slug: string
  description: string | null
  created_at: string
  updated_at: string
}

/**
 * Tenant plan types for multi-tenant SaaS
 */
export type TenantPlan = 'free' | 'starter' | 'pro' | 'enterprise'

/**
 * Tenant resource limits configuration
 */
export interface TenantLimits {
  max_users?: number
  max_cases?: number
  max_storage_gb?: number
  max_documents?: number
  [key: string]: any
}

/**
 * Tenant object structure
 */
export interface Tenant {
  id: string
  name: string
  subdomain: string
  custom_domain: string | null
  plan: TenantPlan
  is_active: boolean
  limits: TenantLimits | null
  trial_ends_at: string | null
  suspended_at: string | null
  suspended_reason: string | null
  created_at: string
  updated_at: string
}

/**
 * Tenant user role types for law firm context
 */
export type TenantUserRole = 'owner' | 'admin' | 'lawyer' | 'assistant'

/**
 * Tenant user relationship object
 */
export interface TenantUser {
  id: number
  tenant_id: string
  user_id: number
  role: TenantUserRole
  custom_permissions: Record<string, any> | null
  is_active: boolean
  invited_at: string | null
  joined_at: string | null
  created_at: string
  updated_at: string
  tenant?: Tenant
  user?: User
}

/**
 * User object structure from backend
 */
export interface User {
  id: number
  full_name: string
  email: string
  username: string | null
  metadata: UserMetadata
  created_at: string
  updated_at: string | null
  roles?: Role[]
  permissions?: Permission[]
  tenant_users?: TenantUser[]
}

/**
 * Authentication context object
 */
export interface Auth {
  user: User | null
  isAuthenticated: boolean
  currentTenant?: Tenant | null
  currentTenantUser?: TenantUser | null
  permissions?: string[]
  roles?: string[]
}

/**
 * Flash message types
 */
export type FlashMessageType = 'success' | 'error' | 'warning' | 'info'

/**
 * Flash message structure
 */
export interface FlashMessage {
  type: FlashMessageType
  message: string
  duration?: number
}

/**
 * Flash messages object for multiple message types
 */
export interface FlashMessages {
  success?: string | string[]
  error?: string | string[]
  warning?: string | string[]
  info?: string | string[]
}

/**
 * Pagination metadata structure
 */
export interface PaginationMeta {
  total: number
  per_page: number
  current_page: number
  last_page: number
  first_page: number
  first_page_url: string
  last_page_url: string
  next_page_url: string | null
  previous_page_url: string | null
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

/**
 * Common Inertia page props shared across all pages
 * These are automatically injected via Inertia's sharedData configuration
 */
export interface PageProps {
  auth?: Auth
  flash?: FlashMessages
  errors?: Record<string, string[]>
  queryParams?: Record<string, any>
  csrf_token?: string
  app_url?: string
  app_name?: string
}

/**
 * Props passed to layout components
 */
export interface LayoutProps {
  children: ReactNode
  title?: string
  description?: string
  breadcrumbs?: Breadcrumb[]
  actions?: ReactNode
  sidebar?: ReactNode
  header?: ReactNode
  footer?: ReactNode
}

/**
 * Navigation menu item structure
 */
export interface NavItem {
  key: string
  label: string
  href?: string
  icon?: ReactNode | string
  badge?: string | number
  badgeVariant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
  children?: NavItem[]
  isActive?: boolean
  isExpanded?: boolean
  isDisabled?: boolean
  onClick?: () => void
  permissions?: string[]
  roles?: RoleSlug[]
  target?: '_blank' | '_self' | '_parent' | '_top'
  className?: string
}

/**
 * Breadcrumb item structure
 */
export interface Breadcrumb {
  label: string
  href?: string
  icon?: ReactNode | string
  isActive?: boolean
  isCurrent?: boolean
}

/**
 * Dropdown menu item structure
 */
export interface DropdownItem {
  key: string
  label: string
  icon?: ReactNode | string
  onClick?: () => void
  href?: string
  variant?: 'default' | 'danger' | 'warning' | 'success'
  isDivider?: boolean
  isDisabled?: boolean
  shortcut?: string
}

/**
 * Table column definition
 */
export interface TableColumn<T = any> {
  key: string
  label: string
  sortable?: boolean
  searchable?: boolean
  width?: string | number
  align?: 'left' | 'center' | 'right'
  render?: (value: any, row: T, index: number) => ReactNode
  className?: string
  headerClassName?: string
}

/**
 * Table sort configuration
 */
export interface TableSort {
  column: string
  direction: 'asc' | 'desc'
}

/**
 * Table filter configuration
 */
export interface TableFilter {
  column: string
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'gt' | 'gte' | 'lt' | 'lte'
  value: any
}

/**
 * Form field error structure
 */
export interface FieldError {
  field: string
  message: string
  rule?: string
}

/**
 * Form validation errors
 */
export interface ValidationErrors {
  [field: string]: string | string[]
}

/**
 * API response structure
 */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  errors?: ValidationErrors
  meta?: Record<string, any>
}

/**
 * Modal component props
 */
export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closeOnOverlayClick?: boolean
  closeOnEsc?: boolean
  showCloseButton?: boolean
  footer?: ReactNode
  className?: string
}

/**
 * Card component props
 */
export interface CardProps {
  title?: string
  description?: string
  children: ReactNode
  header?: ReactNode
  footer?: ReactNode
  className?: string
  hoverable?: boolean
  bordered?: boolean
  loading?: boolean
}

/**
 * Empty state component props
 */
export interface EmptyStateProps {
  title: string
  description?: string
  icon?: ReactNode | string
  action?: ReactNode
  className?: string
}

/**
 * Stat card component props
 */
export interface StatCardProps {
  label: string
  value: string | number
  icon?: ReactNode | string
  trend?: {
    value: number
    direction: 'up' | 'down' | 'neutral'
    label?: string
  }
  loading?: boolean
  className?: string
}

/**
 * Notification/Toast options
 */
export interface NotificationOptions {
  title?: string
  message: string
  type?: FlashMessageType
  duration?: number
  position?:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right'
  action?: {
    label: string
    onClick: () => void
  }
}

/**
 * Search/Filter bar props
 */
export interface SearchFilterProps {
  searchQuery?: string
  onSearchChange?: (query: string) => void
  filters?: TableFilter[]
  onFiltersChange?: (filters: TableFilter[]) => void
  sortBy?: TableSort
  onSortChange?: (sort: TableSort) => void
  placeholder?: string
  className?: string
}

/**
 * Tenant context for multi-tenant operations
 */
export interface TenantContext {
  tenant_id: string
  tenant: Tenant | null
  user_id: number | null
  tenant_user: TenantUser | null
}

/**
 * Date range picker value
 */
export interface DateRange {
  from: Date | string
  to: Date | string
}

/**
 * File upload metadata
 */
export interface FileMetadata {
  name: string
  size: number
  type: string
  url?: string
  preview?: string
  uploaded_at?: string
}

/**
 * Generic list response
 */
export interface ListResponse<T> {
  data: T[]
  total?: number
  page?: number
  per_page?: number
}

/**
 * Helper type to extract props from Inertia page component
 */
export type InertiaPageProps<T = Record<string, unknown>> = T & PageProps

/**
 * Helper type for async component state
 */
export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: Error | null
}

/**
 * Re-export commonly used React types for convenience
 */
export type { ReactNode, ComponentType, ReactElement, JSXElementConstructor } from 'react'
