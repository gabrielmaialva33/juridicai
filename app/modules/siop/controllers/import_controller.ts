import { readFile } from 'node:fs/promises'
import RadarJobRun from '#modules/admin/models/radar_job_run'
import auditService from '#shared/services/audit_service'
import queueService from '#shared/services/queue_service'
import SiopImport from '#modules/siop/models/siop_import'
import SiopStagingRow from '#modules/siop/models/siop_staging_row'
import { SIOP_IMPORT_QUEUE } from '#modules/siop/jobs/siop_import_handler'
import { TRF6_MANUAL_EXPORT_IMPORT_QUEUE } from '#modules/integrations/jobs/trf6_manual_export_import_handler'
import { TRF6_EPROC_FEDERAL_PRECATORIO_EXPORT_URL } from '#modules/integrations/services/trf6_precatorio_adapter'
import trf6ManualExportService from '#modules/integrations/services/trf6_manual_export_service'
import governmentSourceStatusService from '#modules/integrations/services/government_source_status_service'
import siopImportService from '#modules/siop/services/siop_import_service'
import { uploadValidator } from '#modules/siop/validators/upload_validator'
import tenantContext from '#shared/helpers/tenant_context'
import { queueNames } from '#start/jobs'
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
      sources: await governmentSourceStatusService.listSources(tenantId),
    } as any)
  }

  async sources({ response }: HttpContext) {
    const tenantId = tenantContext.requireTenantId()

    return response.ok({
      sources: await governmentSourceStatusService.listSources(tenantId),
      coverage: await governmentSourceStatusService.coverageMap(tenantId),
    })
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

  async jobStatus({ params, request, response }: HttpContext) {
    const tenantId = tenantContext.requireTenantId()
    const queueName = request.input('queueName')

    if (!isKnownQueueName(queueName)) {
      return response.status(422).send({
        code: 'E_INVALID_QUEUE',
        message: 'A valid queueName query parameter is required.',
      })
    }

    const [job, latestRun] = await Promise.all([
      queueService.getJobSnapshot(queueName, params.id),
      RadarJobRun.query()
        .where('tenant_id', tenantId)
        .where('queue_name', queueName)
        .where('bullmq_job_id', params.id)
        .orderBy('created_at', 'desc')
        .first(),
    ])

    if (!job && !latestRun) {
      return response.notFound({
        code: 'E_JOB_NOT_FOUND',
        message: 'The requested job was not found for this tenant.',
      })
    }

    return response.ok({
      job,
      run: latestRun?.serialize() ?? null,
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
        enqueuePostImportEnrichment: true,
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
        enqueuePostImportEnrichment: true,
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
}

function isKnownQueueName(value: unknown): value is (typeof queueNames)[number] {
  return typeof value === 'string' && (queueNames as readonly string[]).includes(value)
}
