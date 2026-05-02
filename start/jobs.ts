import queueService from '#shared/services/queue_service'
import workerHeartbeatService from '#shared/services/worker_heartbeat_service'
import {
  SIOP_IMPORT_QUEUE,
  handleSiopImport,
  type SiopImportJobPayload,
} from '#modules/siop/jobs/siop_import_handler'
import {
  SIOP_RECONCILE_QUEUE,
  handleSiopReconcile,
  type SiopReconcilePayload,
} from '#modules/siop/jobs/siop_reconcile_handler'
import {
  EXPORT_PRECATORIOS_QUEUE,
  handleExportPrecatorios,
  type ExportPrecatoriosPayload,
} from '#modules/exports/jobs/export_precatorios_handler'
import {
  DATAJUD_ENRICH_ASSETS_QUEUE,
  handleDataJudEnrichAssets,
  type DataJudEnrichAssetsPayload,
} from '#modules/integrations/jobs/datajud_enrich_assets_handler'
import {
  DATAJUD_NATIONAL_PRECATORIO_SYNC_QUEUE,
  handleDataJudNationalPrecatorioSync,
  type DataJudNationalPrecatorioSyncPayload,
} from '#modules/integrations/jobs/datajud_national_precatorio_sync_handler'
import {
  DATAJUD_MATCH_CANDIDATES_QUEUE,
  handleDataJudMatchCandidates,
  type DataJudMatchCandidatesPayload,
} from '#modules/integrations/jobs/datajud_match_candidates_handler'
import {
  DATAJUD_LEGAL_SIGNAL_CLASSIFIER_QUEUE,
  handleDataJudLegalSignalClassifier,
  type DataJudLegalSignalClassifierPayload,
} from '#modules/integrations/jobs/datajud_legal_signal_classifier_handler'
import {
  DATAJUD_PROCESS_ASSET_LINK_QUEUE,
  handleDataJudProcessAssetLink,
  type DataJudProcessAssetLinkPayload,
} from '#modules/integrations/jobs/datajud_process_asset_link_handler'
import {
  SIOP_OPEN_DATA_SYNC_QUEUE,
  handleSiopOpenDataSync,
  type SiopOpenDataSyncPayload,
} from '#modules/integrations/jobs/siop_open_data_sync_handler'
import {
  TJSP_PRECATORIO_SYNC_QUEUE,
  handleTjspPrecatorioSync,
  type TjspPrecatorioSyncPayload,
} from '#modules/integrations/jobs/tjsp_precatorio_sync_handler'
import {
  TRIBUNAL_SOURCE_SYNC_QUEUE,
  handleTribunalSourceSync,
  type TribunalSourceSyncPayload,
} from '#modules/integrations/jobs/tribunal_source_sync_handler'
import {
  TRF6_MANUAL_EXPORT_IMPORT_QUEUE,
  handleTrf6ManualExportImport,
  type Trf6ManualExportImportPayload,
} from '#modules/integrations/jobs/trf6_manual_export_import_handler'
import {
  POST_IMPORT_ENRICHMENT_QUEUE,
  handlePostImportEnrichment,
  type PostImportEnrichmentPayload,
} from '#modules/integrations/jobs/post_import_enrichment_handler'
import {
  GOVERNMENT_DATA_SYNC_ORCHESTRATOR_QUEUE,
  handleGovernmentDataSyncOrchestrator,
  type GovernmentDataSyncOrchestratorPayload,
} from '#modules/integrations/jobs/government_data_sync_orchestrator_handler'
import {
  APPLY_RETENTION_POLICY_QUEUE,
  handleApplyRetentionPolicy,
  type ApplyRetentionPolicyPayload,
} from '#modules/maintenance/jobs/apply_retention_policy_handler'
import {
  PURGE_STAGING_QUEUE,
  handlePurgeStaging,
  type PurgeStagingPayload,
} from '#modules/maintenance/jobs/purge_staging_handler'
import {
  REFRESH_AGGREGATES_QUEUE,
  handleRefreshAggregates,
  type RefreshAggregatesPayload,
} from '#modules/maintenance/jobs/refresh_aggregates_handler'
import {
  VACUUM_HINT_QUEUE,
  handleVacuumHint,
  type VacuumHintPayload,
} from '#modules/maintenance/jobs/vacuum_hint_handler'

export const queues = {
  siopImport: { name: SIOP_IMPORT_QUEUE, concurrency: 1 },
  siopReconcile: { name: SIOP_RECONCILE_QUEUE, concurrency: 1 },
  purgeStaging: { name: PURGE_STAGING_QUEUE, concurrency: 1 },
  retentionPolicy: { name: APPLY_RETENTION_POLICY_QUEUE, concurrency: 1 },
  refreshAggregates: { name: REFRESH_AGGREGATES_QUEUE, concurrency: 1 },
  vacuumHint: { name: VACUUM_HINT_QUEUE, concurrency: 1 },
  exportPrecatorios: { name: EXPORT_PRECATORIOS_QUEUE, concurrency: 2 },
  siopOpenDataSync: { name: SIOP_OPEN_DATA_SYNC_QUEUE, concurrency: 1 },
  tjspPrecatorioSync: { name: TJSP_PRECATORIO_SYNC_QUEUE, concurrency: 1 },
  tribunalSourceSync: { name: TRIBUNAL_SOURCE_SYNC_QUEUE, concurrency: 1 },
  trf6ManualExportImport: { name: TRF6_MANUAL_EXPORT_IMPORT_QUEUE, concurrency: 1 },
  postImportEnrichment: { name: POST_IMPORT_ENRICHMENT_QUEUE, concurrency: 1 },
  governmentDataSyncOrchestrator: { name: GOVERNMENT_DATA_SYNC_ORCHESTRATOR_QUEUE, concurrency: 1 },
  dataJudNationalPrecatorioSync: { name: DATAJUD_NATIONAL_PRECATORIO_SYNC_QUEUE, concurrency: 1 },
  dataJudEnrichAssets: { name: DATAJUD_ENRICH_ASSETS_QUEUE, concurrency: 1 },
  dataJudMatchCandidates: { name: DATAJUD_MATCH_CANDIDATES_QUEUE, concurrency: 1 },
  dataJudLegalSignalClassifier: { name: DATAJUD_LEGAL_SIGNAL_CLASSIFIER_QUEUE, concurrency: 1 },
  dataJudProcessAssetLink: { name: DATAJUD_PROCESS_ASSET_LINK_QUEUE, concurrency: 1 },
} as const

export const queueNames = Object.values(queues).map((queue) => queue.name)

let booted = false
let heartbeatInterval: NodeJS.Timeout | null = null

export function bootWorkers() {
  if (booted) {
    return
  }

  queueService.registerWorker<SiopImportJobPayload>(
    queues.siopImport.name,
    async (job) => {
      await handleSiopImport({
        ...job.data,
        bullmqJobId: job.id ? String(job.id) : null,
        attempts: job.attemptsMade + 1,
      })
    },
    { concurrency: queues.siopImport.concurrency }
  )

  queueService.registerWorker<SiopReconcilePayload>(
    queues.siopReconcile.name,
    async (job) => {
      await handleSiopReconcile({
        ...job.data,
        bullmqJobId: job.id ? String(job.id) : null,
        attempts: job.attemptsMade + 1,
      })
    },
    { concurrency: queues.siopReconcile.concurrency }
  )

  queueService.registerWorker<PurgeStagingPayload>(
    queues.purgeStaging.name,
    async (job) => {
      await handlePurgeStaging({
        ...job.data,
        bullmqJobId: job.id ? String(job.id) : null,
        attempts: job.attemptsMade + 1,
      })
    },
    { concurrency: queues.purgeStaging.concurrency }
  )

  queueService.registerWorker<ApplyRetentionPolicyPayload>(
    queues.retentionPolicy.name,
    async (job) => {
      await handleApplyRetentionPolicy({
        ...job.data,
        bullmqJobId: job.id ? String(job.id) : null,
        attempts: job.attemptsMade + 1,
      })
    },
    { concurrency: queues.retentionPolicy.concurrency }
  )

  queueService.registerWorker<RefreshAggregatesPayload>(
    queues.refreshAggregates.name,
    async (job) => {
      await handleRefreshAggregates({
        ...job.data,
        bullmqJobId: job.id ? String(job.id) : null,
        attempts: job.attemptsMade + 1,
      })
    },
    { concurrency: queues.refreshAggregates.concurrency }
  )

  queueService.registerWorker<VacuumHintPayload>(
    queues.vacuumHint.name,
    async (job) => {
      await handleVacuumHint({
        ...job.data,
        bullmqJobId: job.id ? String(job.id) : null,
        attempts: job.attemptsMade + 1,
      })
    },
    { concurrency: queues.vacuumHint.concurrency }
  )

  queueService.registerWorker<ExportPrecatoriosPayload>(
    queues.exportPrecatorios.name,
    async (job) => {
      await handleExportPrecatorios({
        ...job.data,
        bullmqJobId: job.id ? String(job.id) : null,
        attempts: job.attemptsMade + 1,
      })
    },
    { concurrency: queues.exportPrecatorios.concurrency }
  )

  queueService.registerWorker<SiopOpenDataSyncPayload>(
    queues.siopOpenDataSync.name,
    async (job) => {
      await handleSiopOpenDataSync({
        ...job.data,
        bullmqJobId: job.id ? String(job.id) : null,
        attempts: job.attemptsMade + 1,
      })
    },
    { concurrency: queues.siopOpenDataSync.concurrency }
  )

  queueService.registerWorker<TjspPrecatorioSyncPayload>(
    queues.tjspPrecatorioSync.name,
    async (job) => {
      await handleTjspPrecatorioSync({
        ...job.data,
        bullmqJobId: job.id ? String(job.id) : null,
        attempts: job.attemptsMade + 1,
      })
    },
    { concurrency: queues.tjspPrecatorioSync.concurrency }
  )

  queueService.registerWorker<TribunalSourceSyncPayload>(
    queues.tribunalSourceSync.name,
    async (job) => {
      await handleTribunalSourceSync({
        ...job.data,
        bullmqJobId: job.id ? String(job.id) : null,
        attempts: job.attemptsMade + 1,
      })
    },
    { concurrency: queues.tribunalSourceSync.concurrency }
  )

  queueService.registerWorker<Trf6ManualExportImportPayload>(
    queues.trf6ManualExportImport.name,
    async (job) => {
      await handleTrf6ManualExportImport({
        ...job.data,
        bullmqJobId: job.id ? String(job.id) : null,
        attempts: job.attemptsMade + 1,
      })
    },
    { concurrency: queues.trf6ManualExportImport.concurrency }
  )

  queueService.registerWorker<PostImportEnrichmentPayload>(
    queues.postImportEnrichment.name,
    async (job) => {
      await handlePostImportEnrichment({
        ...job.data,
        bullmqJobId: job.id ? String(job.id) : null,
        attempts: job.attemptsMade + 1,
      })
    },
    { concurrency: queues.postImportEnrichment.concurrency }
  )

  queueService.registerWorker<GovernmentDataSyncOrchestratorPayload>(
    queues.governmentDataSyncOrchestrator.name,
    async (job) => {
      await handleGovernmentDataSyncOrchestrator({
        ...job.data,
        bullmqJobId: job.id ? String(job.id) : null,
        attempts: job.attemptsMade + 1,
      })
    },
    { concurrency: queues.governmentDataSyncOrchestrator.concurrency }
  )

  queueService.registerWorker<DataJudEnrichAssetsPayload>(
    queues.dataJudEnrichAssets.name,
    async (job) => {
      await handleDataJudEnrichAssets({
        ...job.data,
        bullmqJobId: job.id ? String(job.id) : null,
        attempts: job.attemptsMade + 1,
      })
    },
    { concurrency: queues.dataJudEnrichAssets.concurrency }
  )

  queueService.registerWorker<DataJudNationalPrecatorioSyncPayload>(
    queues.dataJudNationalPrecatorioSync.name,
    async (job) => {
      await handleDataJudNationalPrecatorioSync({
        ...job.data,
        bullmqJobId: job.id ? String(job.id) : null,
        attempts: job.attemptsMade + 1,
      })
    },
    { concurrency: queues.dataJudNationalPrecatorioSync.concurrency }
  )

  queueService.registerWorker<DataJudMatchCandidatesPayload>(
    queues.dataJudMatchCandidates.name,
    async (job) => {
      await handleDataJudMatchCandidates({
        ...job.data,
        bullmqJobId: job.id ? String(job.id) : null,
        attempts: job.attemptsMade + 1,
      })
    },
    { concurrency: queues.dataJudMatchCandidates.concurrency }
  )

  queueService.registerWorker<DataJudLegalSignalClassifierPayload>(
    queues.dataJudLegalSignalClassifier.name,
    async (job) => {
      await handleDataJudLegalSignalClassifier({
        ...job.data,
        bullmqJobId: job.id ? String(job.id) : null,
        attempts: job.attemptsMade + 1,
      })
    },
    { concurrency: queues.dataJudLegalSignalClassifier.concurrency }
  )

  queueService.registerWorker<DataJudProcessAssetLinkPayload>(
    queues.dataJudProcessAssetLink.name,
    async (job) => {
      await handleDataJudProcessAssetLink({
        ...job.data,
        bullmqJobId: job.id ? String(job.id) : null,
        attempts: job.attemptsMade + 1,
      })
    },
    { concurrency: queues.dataJudProcessAssetLink.concurrency }
  )

  heartbeatInterval = setInterval(() => {
    void writeHeartbeats()
  }, 30_000)
  void writeHeartbeats()
  booted = true
}

export async function shutdownWorkers() {
  if (!booted) {
    return
  }

  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
  }

  await queueService.shutdown()
  booted = false
}

async function writeHeartbeats() {
  try {
    await Promise.all(
      queueNames.map((queueName) =>
        workerHeartbeatService.beat({
          workerId: `${process.pid}:${queueName}`,
          queueName,
          metadata: {
            runtime: 'bullmq',
          },
        })
      )
    )
  } catch {
    // Heartbeats are diagnostic only; worker processors must keep running.
  }
}
