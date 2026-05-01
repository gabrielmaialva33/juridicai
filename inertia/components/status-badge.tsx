import { Badge } from '@/components/ui/badge'

type LifecycleStatus =
  | 'unknown'
  | 'discovered'
  | 'expedited'
  | 'pending'
  | 'in_payment'
  | 'paid'
  | 'cancelled'
  | 'suspended'

type ComplianceStatus =
  | 'pending'
  | 'approved_for_analysis'
  | 'approved_for_sales'
  | 'blocked'
  | 'opt_out'

type PiiStatus = 'none' | 'pseudonymous' | 'bunker_available' | 'materialized' | 'blocked'

type ImportStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed'

type JobRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled'

type Variant = 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'outline' | 'destructive'

const LIFECYCLE_VARIANT: Record<LifecycleStatus, Variant> = {
  unknown: 'outline',
  discovered: 'info',
  expedited: 'primary',
  pending: 'warning',
  in_payment: 'info',
  paid: 'success',
  cancelled: 'secondary',
  suspended: 'destructive',
}

const COMPLIANCE_VARIANT: Record<ComplianceStatus, Variant> = {
  pending: 'outline',
  approved_for_analysis: 'info',
  approved_for_sales: 'success',
  blocked: 'destructive',
  opt_out: 'destructive',
}

const PII_VARIANT: Record<PiiStatus, Variant> = {
  none: 'outline',
  pseudonymous: 'secondary',
  bunker_available: 'info',
  materialized: 'warning',
  blocked: 'destructive',
}

const IMPORT_VARIANT: Record<ImportStatus, Variant> = {
  pending: 'outline',
  running: 'info',
  completed: 'success',
  partial: 'warning',
  failed: 'destructive',
}

const JOB_RUN_VARIANT: Record<JobRunStatus, Variant> = {
  pending: 'outline',
  running: 'info',
  completed: 'success',
  failed: 'destructive',
  skipped: 'secondary',
  cancelled: 'secondary',
}

const LIFECYCLE_LABEL: Record<LifecycleStatus, string> = {
  unknown: 'Desconhecido',
  discovered: 'Descoberto',
  expedited: 'Expedido',
  pending: 'Pendente',
  in_payment: 'Em pagamento',
  paid: 'Pago',
  cancelled: 'Cancelado',
  suspended: 'Suspenso',
}

const COMPLIANCE_LABEL: Record<ComplianceStatus, string> = {
  pending: 'Pendente',
  approved_for_analysis: 'Aprovado análise',
  approved_for_sales: 'Aprovado venda',
  blocked: 'Bloqueado',
  opt_out: 'Opt-out',
}

const PII_LABEL: Record<PiiStatus, string> = {
  none: 'Sem PII',
  pseudonymous: 'Pseudonimizado',
  bunker_available: 'No bunker',
  materialized: 'Materializado',
  blocked: 'Bloqueado',
}

const IMPORT_LABEL: Record<ImportStatus, string> = {
  pending: 'Pendente',
  running: 'Em execução',
  completed: 'Concluído',
  partial: 'Parcial',
  failed: 'Falhou',
}

const JOB_RUN_LABEL: Record<JobRunStatus, string> = {
  pending: 'Pendente',
  running: 'Em execução',
  completed: 'Concluído',
  failed: 'Falhou',
  skipped: 'Pulado',
  cancelled: 'Cancelado',
}

interface Props {
  kind: 'lifecycle' | 'compliance' | 'pii' | 'import' | 'job_run'
  value: string
}

export function StatusBadge({ kind, value }: Props) {
  let variant: Variant = 'outline'
  let label = value

  switch (kind) {
    case 'lifecycle':
      variant = LIFECYCLE_VARIANT[value as LifecycleStatus] ?? 'outline'
      label = LIFECYCLE_LABEL[value as LifecycleStatus] ?? value
      break
    case 'compliance':
      variant = COMPLIANCE_VARIANT[value as ComplianceStatus] ?? 'outline'
      label = COMPLIANCE_LABEL[value as ComplianceStatus] ?? value
      break
    case 'pii':
      variant = PII_VARIANT[value as PiiStatus] ?? 'outline'
      label = PII_LABEL[value as PiiStatus] ?? value
      break
    case 'import':
      variant = IMPORT_VARIANT[value as ImportStatus] ?? 'outline'
      label = IMPORT_LABEL[value as ImportStatus] ?? value
      break
    case 'job_run':
      variant = JOB_RUN_VARIANT[value as JobRunStatus] ?? 'outline'
      label = JOB_RUN_LABEL[value as JobRunStatus] ?? value
      break
  }

  return (
    <Badge variant={variant} className="px-2 py-0.5 text-xs font-medium">
      {label}
    </Badge>
  )
}
