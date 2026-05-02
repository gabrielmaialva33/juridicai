import { readFile } from 'node:fs/promises'
import db from '@adonisjs/lucid/services/db'
import auditService from '#shared/services/audit_service'
import queueService from '#shared/services/queue_service'
import SiopImport from '#modules/siop/models/siop_import'
import SiopStagingRow from '#modules/siop/models/siop_staging_row'
import { SIOP_IMPORT_QUEUE } from '#modules/siop/jobs/siop_import_handler'
import { TRF6_MANUAL_EXPORT_IMPORT_QUEUE } from '#modules/integrations/jobs/trf6_manual_export_import_handler'
import { TRF6_EPROC_FEDERAL_PRECATORIO_EXPORT_URL } from '#modules/integrations/services/trf6_precatorio_adapter'
import trf6ManualExportService from '#modules/integrations/services/trf6_manual_export_service'
import SourceDataset from '#modules/integrations/models/source_dataset'
import GovernmentSourceTarget from '#modules/integrations/models/government_source_target'
import siopImportService from '#modules/siop/services/siop_import_service'
import { uploadValidator } from '#modules/siop/validators/upload_validator'
import tenantContext from '#shared/helpers/tenant_context'
import type { HttpContext } from '@adonisjs/core/http'

type UploadedFile = {
  tmpPath?: string
  clientName?: string
  type?: string
  size?: number
  isValid?: boolean
  errors?: unknown[]
}

export default class ImportController {
  async index({ inertia }: HttpContext) {
    const tenantId = tenantContext.requireTenantId()
    const imports = await siopImportService.listRecentImports(tenantId)

    return inertia.render('siop/imports/index', {
      imports: imports.map((importRow) => importRow.serialize()) as any,
      sources: await this.listGovernmentSources(tenantId),
    } as any)
  }

  async newForm({ inertia }: HttpContext) {
    return inertia.render('siop/imports/new', {
      manualSources: {
        trf6FederalPrecatorios: {
          exportUrl: TRF6_EPROC_FEDERAL_PRECATORIO_EXPORT_URL,
        },
      },
    })
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const tenantId = tenantContext.requireTenantId()
    const payload = await request.validateUsing(uploadValidator)
    const file = request.file('file') as UploadedFile | null

    if (!file || !file.tmpPath || file.isValid === false) {
      return response.status(422).send({
        code: 'E_INVALID_UPLOAD',
        message: 'A valid SIOP CSV or XLSX file is required.',
        errors: file?.errors ?? [],
      })
    }

    const buffer = await readFile(file.tmpPath)
    const result = await siopImportService.createPendingFileImport({
      tenantId,
      exerciseYear: payload.exerciseYear,
      buffer,
      originalFilename: file.clientName ?? 'siop-import.xlsx',
      mimeType: file.type ?? null,
      fileSizeBytes: file.size ?? buffer.byteLength,
      uploadedByUserId: user.id,
    })

    if (result.import.status === 'completed') {
      return response.conflict({
        code: 'E_IMPORT_ALREADY_COMPLETED',
        message: 'This SIOP file has already been imported successfully.',
      })
    }

    if (
      !result.created &&
      (result.import.status === 'pending' || result.import.status === 'running')
    ) {
      return response.accepted({
        import: result.import.serialize(),
        job: null,
      })
    }

    const job = await this.enqueueImport(tenantId, result.import.id, 'siop-import')

    return response.accepted({
      import: result.import.serialize(),
      job: {
        id: job.id,
        name: job.name,
      },
    })
  }

  async storeTrf6Export({ auth, request, response }: HttpContext) {
    auth.getUserOrFail()
    const tenantId = tenantContext.requireTenantId()
    const payload = await request.validateUsing(uploadValidator)
    const file = request.file('file') as UploadedFile | null

    if (!file || !file.tmpPath || file.isValid === false) {
      return response.status(422).send({
        code: 'E_INVALID_UPLOAD',
        message: 'A valid TRF6 CSV export is required.',
        errors: file?.errors ?? [],
      })
    }

    const filename = file.clientName ?? 'relatorio_precatorios_orcamentarios.csv'
    if (!filename.toLowerCase().endsWith('.csv')) {
      return response.status(422).send({
        code: 'E_INVALID_UPLOAD_TYPE',
        message: 'TRF6 manual exports must be uploaded as CSV files.',
      })
    }

    const buffer = await readFile(file.tmpPath)
    const persisted = await trf6ManualExportService.persistExport({
      tenantId,
      exerciseYear: payload.exerciseYear,
      buffer,
      originalFilename: filename,
      mimeType: file.type ?? 'text/csv',
      fileSizeBytes: file.size ?? buffer.byteLength,
    })
    const job = await queueService.add(
      TRF6_MANUAL_EXPORT_IMPORT_QUEUE,
      'trf6-manual-export-import',
      {
        tenantId,
        sourceRecordId: persisted.sourceRecord.id,
        chunkSize: 500,
        requestId: tenantContext.get()?.requestId ?? null,
        origin: 'http' as const,
      },
      {
        jobId: `trf6-manual-export-import-${tenantId}-${persisted.sourceRecord.id}-${Date.now()}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    )

    return response.accepted({
      sourceRecord: {
        id: persisted.sourceRecord.id,
        created: persisted.created,
        originalFilename: persisted.sourceRecord.originalFilename,
      },
      job: {
        id: job.id,
        name: job.name,
        queueName: TRF6_MANUAL_EXPORT_IMPORT_QUEUE,
      },
    })
  }

  async show({ inertia, params }: HttpContext) {
    const siopImport = await this.findTenantImport(params.id, tenantContext.requireTenantId())
    const invalidRows = await SiopStagingRow.query()
      .where('import_id', siopImport.id)
      .where('validation_status', 'invalid')
      .orderBy('created_at', 'desc')
      .limit(25)

    return inertia.render('siop/imports/show', {
      import: siopImport.serialize() as any,
      invalidRows: invalidRows.map((row) => row.serialize()) as any,
    })
  }

  async errors({ inertia, params, request }: HttpContext) {
    const page = request.input('page', 1)
    const siopImport = await this.findTenantImport(params.id, tenantContext.requireTenantId())
    const rows = await SiopStagingRow.query()
      .where('import_id', siopImport.id)
      .where('validation_status', 'invalid')
      .orderBy('created_at', 'desc')
      .paginate(page, 50)

    return inertia.render('siop/imports/errors', {
      import: siopImport.serialize() as any,
      rows: rows.serialize() as any,
    })
  }

  async reprocess({ params, response }: HttpContext) {
    const tenantId = tenantContext.requireTenantId()
    const siopImport = await this.findTenantImport(params.id, tenantId)

    if (siopImport.status === 'completed') {
      return response.conflict({
        code: 'E_IMPORT_ALREADY_COMPLETED',
        message: 'Completed imports cannot be reprocessed.',
      })
    }

    if (siopImport.status === 'pending' || siopImport.status === 'running') {
      return response.accepted({
        import: siopImport.serialize(),
        job: null,
      })
    }

    const job = await this.enqueueImport(tenantId, siopImport.id, 'siop-reprocess')

    return response.accepted({
      import: siopImport.serialize(),
      job: {
        id: job.id,
        name: job.name,
      },
    })
  }

  async downloadSource({ auth, params, response, requestId }: HttpContext) {
    const user = auth.getUserOrFail()
    const tenantId = tenantContext.requireTenantId()
    const siopImport = await this.findTenantImport(params.id, tenantId)
    const sourceFilePath = siopImport.sourceRecord.sourceFilePath

    if (!sourceFilePath) {
      return response.notFound({
        code: 'E_IMPORT_SOURCE_MISSING',
        message: 'The source file for this import is not available.',
      })
    }

    await auditService.write({
      tenantId,
      userId: user.id,
      event: 'siop_import_source_downloaded',
      entityType: 'siop_import',
      entityId: siopImport.id,
      requestId,
    })

    return response.attachment(
      sourceFilePath,
      siopImport.sourceRecord.originalFilename ?? `siop-import-${siopImport.id}.xlsx`
    )
  }

  private async findTenantImport(id: string, tenantId: string) {
    return SiopImport.query()
      .where('id', id)
      .where('tenant_id', tenantId)
      .preload('sourceRecord')
      .firstOrFail()
  }

  private enqueueImport(tenantId: string, importId: string, jobName: string) {
    return queueService.add(
      SIOP_IMPORT_QUEUE,
      jobName,
      {
        tenantId,
        importId,
        requestId: tenantContext.get()?.requestId ?? null,
      },
      {
        jobId: `${jobName}-${tenantId}-${importId}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    )
  }

  private async listGovernmentSources(tenantId: string) {
    const [targets, datasets, sourceRecordCounts, lastRuns] = await Promise.all([
      GovernmentSourceTarget.query()
        .preload('sourceDataset')
        .where('is_active', true)
        .orderBy('priority', 'asc')
        .orderBy('name', 'asc'),
      SourceDataset.query()
        .where('is_active', true)
        .orderBy('priority', 'asc')
        .orderBy('name', 'asc'),
      db
        .from('source_records')
        .select('source_dataset_id')
        .count('* as records_count')
        .max('collected_at as last_collected_at')
        .where('tenant_id', tenantId)
        .whereNotNull('source_dataset_id')
        .groupBy('source_dataset_id'),
      db
        .from('radar_job_runs')
        .select('job_name')
        .max('created_at as last_created_at')
        .where('tenant_id', tenantId)
        .groupBy('job_name'),
    ])
    const countsByDataset = new Map(
      sourceRecordCounts.map((row) => [
        String(row.source_dataset_id),
        {
          recordsCount: Number(row.records_count ?? 0),
          lastCollectedAt: row.last_collected_at,
        },
      ])
    )
    const lastRunByJob = new Map(
      lastRuns.map((row) => [
        String(row.job_name),
        {
          lastRunAt: row.last_created_at,
        },
      ])
    )
    const targetDatasetIds = new Set(targets.map((target) => target.sourceDatasetId))
    const sourceTargets = targets.map((target) => {
      const sourceUrl = target.sourceUrl ?? target.sourceDataset.baseUrl
      const metadata = target.metadata ?? target.sourceDataset.metadata ?? {}
      const counts = countsByDataset.get(target.sourceDatasetId)

      return {
        id: target.id,
        key: target.key,
        name: target.name,
        owner: target.sourceDataset.owner,
        level: target.federativeLevel,
        source: target.source,
        priority: target.priority,
        status: target.status,
        cadence: target.cadence,
        courtAlias: target.courtAlias,
        stateCode: target.stateCode,
        format: target.sourceFormat ?? target.sourceDataset.format,
        sourceUrl,
        manualExportUrl: stringFrom(metadata.manualExportUrl),
        blockedLinks: stringArrayFrom(metadata.blockedLinks),
        coverageScore: target.coverageScore,
        lastSuccessAt: target.lastSuccessAt?.toISO() ?? null,
        lastErrorAt: target.lastErrorAt?.toISO() ?? null,
        lastErrorMessage: target.lastErrorMessage,
        lastDiscoveredCount: target.lastDiscoveredCount,
        lastSourceRecordsCount: target.lastSourceRecordsCount,
        tenantSourceRecordsCount: counts?.recordsCount ?? 0,
        tenantLastCollectedAt: counts?.lastCollectedAt ?? null,
        adapterKey: target.adapterKey,
        lastJobRunAt: lastRunByJob.get(jobNameForTarget(target.adapterKey))?.lastRunAt ?? null,
      }
    })
    const datasetOnlySources = datasets
      .filter((dataset) => !targetDatasetIds.has(dataset.id))
      .map((dataset) => {
        const counts = countsByDataset.get(dataset.id)

        return {
          id: dataset.id,
          key: dataset.key,
          name: dataset.name,
          owner: dataset.owner,
          level: dataset.federativeLevel,
          source: dataset.source,
          priority: dataset.priority,
          status: 'pending',
          cadence: null,
          courtAlias: dataset.courtAlias,
          stateCode: dataset.stateCode,
          format: dataset.format,
          sourceUrl: dataset.baseUrl,
          manualExportUrl: stringFrom(dataset.metadata?.manualExportUrl),
          blockedLinks: stringArrayFrom(dataset.metadata?.blockedLinks),
          coverageScore: null,
          lastSuccessAt: null,
          lastErrorAt: null,
          lastErrorMessage: null,
          lastDiscoveredCount: 0,
          lastSourceRecordsCount: 0,
          tenantSourceRecordsCount: counts?.recordsCount ?? 0,
          tenantLastCollectedAt: counts?.lastCollectedAt ?? null,
          adapterKey: null,
          lastJobRunAt: null,
        }
      })

    return [...sourceTargets, ...datasetOnlySources]
  }
}

function stringFrom(value: unknown) {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function stringArrayFrom(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function jobNameForTarget(adapterKey: string | null) {
  if (adapterKey === 'siop_open_data_sync') {
    return 'siop-open-data-sync'
  }

  if (adapterKey === 'tjsp_precatorio_sync') {
    return 'tjsp-precatorio-sync'
  }

  if (adapterKey?.includes('trf')) {
    return 'tribunal-source-sync'
  }

  return 'government-data-sync-orchestrator'
}
