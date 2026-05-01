export type AssetNature = 'alimentar' | 'comum' | 'tributario' | 'unknown'

export type ClientErrorStatus = 'new' | 'triaged' | 'resolved' | 'ignored'

export type ComplianceStatus =
  | 'pending'
  | 'approved_for_analysis'
  | 'approved_for_sales'
  | 'blocked'
  | 'opt_out'

export type DebtorType = 'union' | 'state' | 'municipality' | 'autarchy' | 'foundation'

export type ExportStatus = 'pending' | 'running' | 'completed' | 'failed' | 'expired'

export type ImportStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed'

export type JobRunOrigin = 'scheduler' | 'http' | 'manual_retry' | 'system'

export type JobRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled'

export type AssetSourceLinkType = 'primary' | 'enrichment' | 'cross_check' | 'conflict' | 'manual'

export type ExternalIdentifierType =
  | 'cnj_number'
  | 'precatorio_number'
  | 'requisition_number'
  | 'origin_process_number'
  | 'asset_number'
  | 'chronological_order'
  | 'source_external_id'
  | 'datajud_id'
  | 'payment_queue_id'

export type FederativeLevel = 'federal' | 'state' | 'municipal' | 'multi_level'

export type SourceDatasetAccess = 'public' | 'credentialed' | 'certificate'

export type SourceDatasetKind =
  | 'open_data_file'
  | 'soap_webservice'
  | 'public_search_api'
  | 'tribunal_publication'

export type SourceDatasetPriority = 'primary' | 'enrichment' | 'cross_check'

export type LifecycleStatus =
  | 'unknown'
  | 'discovered'
  | 'expedited'
  | 'pending'
  | 'in_payment'
  | 'paid'
  | 'cancelled'
  | 'suspended'

export type MembershipStatus = 'active' | 'inactive'

export type PaymentRegime = 'none' | 'special' | 'federal_unique' | 'other'

export type PiiAction =
  | 'attempt_reveal'
  | 'reveal_denied'
  | 'reveal_success'
  | 'export'
  | 'contact'
  | 'update'
  | 'delete'

export type PiiStatus = 'none' | 'pseudonymous' | 'bunker_available' | 'materialized' | 'blocked'

export type SourceType = 'siop' | 'datajud' | 'djen' | 'tribunal' | 'api_private' | 'manual'

export type StagingValidationStatus = 'pending' | 'valid' | 'invalid' | 'warning'

export type TenantStatus = 'active' | 'suspended' | 'inactive'

export type UserStatus = 'active' | 'disabled'

export type JsonRecord = Record<string, unknown>
