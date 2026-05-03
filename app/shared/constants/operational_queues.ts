export const operationalQueueNames = [
  'siop-imports',
  'siop-reconcile',
  'maintenance-purge-staging',
  'maintenance-apply-retention-policy',
  'maintenance-refresh-aggregates',
  'maintenance-vacuum-hint',
  'admin-operational-recovery',
  'exports-precatorios',
  'siop-open-data-sync',
  'tjsp-precatorio-sync',
  'tribunal-source-sync',
  'trf6-manual-export-import',
  'post-import-enrichment',
  'government-data-sync-orchestrator',
  'datajud-national-precatorio-sync',
  'datajud-enrich-assets',
  'datajud-match-candidates',
  'datajud-legal-signal-classifier',
  'datajud-process-asset-link',
] as const

export type OperationalQueueName = (typeof operationalQueueNames)[number]
