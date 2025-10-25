/**
 * API Response Types
 */

// Pagination metadata
export interface PaginationMeta {
  total: number
  perPage: number
  currentPage: number
  lastPage: number
  firstPage: number
  firstPageUrl: string
  lastPageUrl: string
  nextPageUrl: string | null
  previousPageUrl: string | null
}

// Paginated response
export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

// Client types
export type ClientType = 'individual' | 'company'

export interface ClientAddress {
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  zip_code?: string
  country?: string
}

export interface Client {
  id: number
  tenant_id: string
  client_type: ClientType
  full_name?: string | null
  company_name?: string | null
  cpf?: string | null
  cnpj?: string | null
  email?: string | null
  phone?: string | null
  address?: ClientAddress | null
  notes?: string | null
  tags?: string[] | null
  custom_fields?: Record<string, any> | null
  is_active: boolean
  created_at: string
  updated_at: string
  display_name?: string // Computed property
  tax_id?: string | null // Computed property
  cases_count?: number // Relationship count
}

export interface CreateClientData {
  client_type: ClientType
  full_name?: string
  company_name?: string
  cpf?: string
  cnpj?: string
  email?: string
  phone?: string
  address?: ClientAddress
  notes?: string
  tags?: string[]
  custom_fields?: Record<string, any>
}

export type UpdateClientData = Partial<CreateClientData>

// Case types
export type CaseType =
  | 'civil'
  | 'criminal'
  | 'labor'
  | 'family'
  | 'tax'
  | 'administrative'
  | 'other'
export type CaseStatus = 'active' | 'closed' | 'archived' | 'suspended'
export type CasePriority = 'low' | 'medium' | 'high' | 'urgent'
export type CourtInstance = '1ª instância' | '2ª instância' | 'Superior'

export interface CaseParties {
  plaintiffs?: Array<{ name: string; role: string }>
  defendants?: Array<{ name: string; role: string }>
  others?: Array<{ name: string; role: string }>
}

export interface Case {
  id: number
  tenant_id: string
  client_id: number
  responsible_lawyer_id?: number | null
  case_number?: string | null // CNJ format
  internal_number?: string | null
  case_type: CaseType
  status: CaseStatus
  priority: CasePriority
  court?: string | null
  court_instance?: CourtInstance | null
  description?: string | null
  case_value?: string | null // Decimal string
  case_parties?: CaseParties | null
  tags?: string[] | null
  metadata?: Record<string, any> | null
  started_at?: string | null
  closed_at?: string | null
  created_at: string
  updated_at: string
  client?: Client
  deadlines_count?: number
  documents_count?: number
  events_count?: number
}

export interface CreateCaseData {
  client_id: number
  responsible_lawyer_id?: number
  case_number?: string
  internal_number?: string
  case_type: CaseType
  status?: CaseStatus
  priority?: CasePriority
  court?: string
  court_instance?: CourtInstance
  description?: string
  case_value?: string
  case_parties?: CaseParties
  tags?: string[]
  metadata?: Record<string, any>
  started_at?: string
}

export type UpdateCaseData = Partial<CreateCaseData>

// Document types
export type DocumentType =
  | 'petition'
  | 'contract'
  | 'evidence'
  | 'judgment'
  | 'appeal'
  | 'power_of_attorney'
  | 'agreement'
  | 'report'
  | 'other'

export type AccessLevel = 'tenant' | 'case_team' | 'owner_only'

export interface Document {
  id: number
  tenant_id: string
  case_id?: number | null
  client_id?: number | null
  uploaded_by: number
  title: string
  description?: string | null
  document_type: DocumentType
  file_path: string
  file_name: string
  file_size: number
  file_mime_type: string
  file_hash?: string | null
  access_level: AccessLevel
  tags?: string[] | null
  metadata?: Record<string, any> | null
  is_ocr_processed: boolean
  ocr_text?: string | null
  is_signed: boolean
  signature_data?: Record<string, any> | null
  version: number
  parent_document_id?: number | null
  created_at: string
  updated_at: string
  case?: Case
  client?: Client
  download_url?: string // Computed/presigned URL
}

export interface CreateDocumentData {
  case_id?: number
  client_id?: number
  title: string
  description?: string
  document_type: DocumentType
  access_level?: AccessLevel
  tags?: string[]
  metadata?: Record<string, any>
}

// Deadline types
export interface Deadline {
  id: number
  tenant_id: string
  case_id: number
  responsible_user_id?: number | null
  title: string
  description?: string | null
  deadline_date: string // ISO date
  internal_deadline_date?: string | null // ISO date
  is_fatal: boolean
  alert_config?: Record<string, any> | null
  is_completed: boolean
  completed_at?: string | null
  completed_by?: number | null
  notes?: string | null
  metadata?: Record<string, any> | null
  created_at: string
  updated_at: string
  case?: Case
  is_overdue?: boolean // Computed
  days_until_deadline?: number // Computed
  is_approaching?: boolean // Computed
}

export interface CreateDeadlineData {
  case_id: number
  responsible_user_id?: number
  title: string
  description?: string
  deadline_date: string
  internal_deadline_date?: string
  is_fatal?: boolean
  alert_config?: Record<string, any>
  notes?: string
}

export type UpdateDeadlineData = Partial<CreateDeadlineData>

// Time Entry types
export interface TimeEntry {
  id: number
  tenant_id: string
  user_id: number
  case_id?: number | null
  description: string
  started_at?: string | null
  ended_at?: string | null
  duration_minutes?: number | null
  duration_hours?: number | null
  hourly_rate?: string | null // Decimal string
  amount?: string | null // Decimal string (computed)
  is_billable: boolean
  tags?: string[] | null
  metadata?: Record<string, any> | null
  is_deleted: boolean
  created_at: string
  updated_at: string
  case?: Case
  is_running?: boolean // Computed
}

export interface CreateTimeEntryData {
  case_id?: number
  description: string
  started_at?: string
  ended_at?: string
  duration_minutes?: number
  hourly_rate?: string
  is_billable?: boolean
  tags?: string[]
  metadata?: Record<string, any>
}

export type UpdateTimeEntryData = Partial<CreateTimeEntryData>

// Case Event types
export type EventType =
  | 'filing'
  | 'hearing'
  | 'decision'
  | 'publication'
  | 'appeal'
  | 'motion'
  | 'settlement'
  | 'judgment'
  | 'other'

export type EventSource = 'manual' | 'court_api' | 'email' | 'import'

export interface CaseEvent {
  id: number
  tenant_id: string
  case_id: number
  created_by?: number | null
  event_type: EventType
  source: EventSource
  title: string
  description?: string | null
  event_date: string
  metadata?: Record<string, any> | null
  created_at: string
  updated_at: string
  case?: Case
}

// User types
export interface User {
  id: number
  full_name: string
  email: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// Filter types
export interface ClientFilters {
  search?: string
  client_type?: ClientType
  state?: string
  city?: string
  tags?: string[]
  is_active?: boolean
  page?: number
  per_page?: number
}

export interface CaseFilters {
  search?: string
  client_id?: number
  case_type?: CaseType
  status?: CaseStatus
  priority?: CasePriority
  responsible_lawyer_id?: number
  page?: number
  per_page?: number
}

export interface DocumentFilters {
  search?: string
  document_type?: DocumentType
  case_id?: number
  client_id?: number
  page?: number
  per_page?: number
}

export interface DeadlineFilters {
  search?: string
  case_id?: number
  responsible_user_id?: number
  is_completed?: boolean
  is_fatal?: boolean
  overdue?: boolean
  upcoming?: number // days
  page?: number
  per_page?: number
}

export interface TimeEntryFilters {
  case_id?: number
  user_id?: number
  is_billable?: boolean
  start_date?: string
  end_date?: string
  page?: number
  per_page?: number
}
