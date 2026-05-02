import { createHash } from 'node:crypto'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import auditService from '#shared/services/audit_service'
import queueService from '#shared/services/queue_service'
import SiopImport from '#modules/siop/models/siop_import'
import SiopStagingRow from '#modules/siop/models/siop_staging_row'
import { SIOP_IMPORT_QUEUE } from '#modules/siop/jobs/siop_import_handler'
import { TRF6_EPROC_FEDERAL_PRECATORIO_EXPORT_URL } from '#modules/integrations/services/trf6_precatorio_adapter'
import trf6PrecatorioImportService from '#modules/integrations/services/trf6_precatorio_import_service'
import sourceEvidenceService from '#modules/integrations/services/source_evidence_service'
import siopImportService from '#modules/siop/services/siop_import_service'
import SourceRecord from '#modules/siop/models/source_record'
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
    const imports = await siopImportService.listRecentImports(tenantContext.requireTenantId())

    return inertia.render('siop/imports/index', {
      imports: imports.map((importRow) => importRow.serialize()) as any,
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
    const sourceRecord = await this.persistTrf6ManualExport({
      tenantId,
      exerciseYear: payload.exerciseYear,
      buffer,
      originalFilename: filename,
      mimeType: file.type ?? 'text/csv',
      fileSizeBytes: file.size ?? buffer.byteLength,
    })
    const result = await trf6PrecatorioImportService.importSourceRecord(sourceRecord.id, {
      chunkSize: 500,
    })

    return response.accepted({
      sourceRecordId: result.sourceRecord.id,
      extraction: {
        format: result.extraction.format,
        status: result.extraction.status,
        rows: result.extraction.rows.length,
        errors: result.extraction.errors,
      },
      stats: result.stats,
      chunking: result.chunking,
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

  private async persistTrf6ManualExport(payload: {
    tenantId: string
    exerciseYear: number
    buffer: Buffer
    originalFilename: string
    mimeType?: string | null
    fileSizeBytes?: number | bigint | null
  }) {
    const checksum = createHash('sha256').update(payload.buffer).digest('hex')
    const filename = basename(payload.originalFilename)
    const directory = app.makePath('storage', 'tribunal', 'trf6', payload.tenantId)
    const storedPath = app.makePath('storage', 'tribunal', 'trf6', payload.tenantId, filename)
    const sourceDatasetId = await sourceEvidenceService.datasetIdByKey(
      'trf6-federal-precatorio-orders'
    )
    const rawData = {
      providerId: 'trf6-federal-precatorio-orders',
      courtAlias: 'trf6',
      sourceKind: 'federal_budget_order',
      year: payload.exerciseYear,
      sourceUrl: TRF6_EPROC_FEDERAL_PRECATORIO_EXPORT_URL,
      format: 'csv',
      originalFilename: filename,
      manualExport: true,
    }

    await mkdir(directory, { recursive: true })
    await writeFile(storedPath, payload.buffer)

    const existing = await SourceRecord.query()
      .where('tenant_id', payload.tenantId)
      .where('source', 'tribunal')
      .where('source_checksum', checksum)
      .first()

    if (existing) {
      existing.merge({
        sourceDatasetId,
        sourceUrl: TRF6_EPROC_FEDERAL_PRECATORIO_EXPORT_URL,
        sourceFilePath: storedPath,
        originalFilename: filename,
        mimeType: payload.mimeType ?? 'text/csv',
        fileSizeBytes: payload.fileSizeBytes ?? payload.buffer.byteLength,
        rawData,
      })
      await existing.save()
      return existing
    }

    return SourceRecord.create({
      tenantId: payload.tenantId,
      sourceDatasetId,
      source: 'tribunal',
      sourceUrl: TRF6_EPROC_FEDERAL_PRECATORIO_EXPORT_URL,
      sourceFilePath: storedPath,
      sourceChecksum: checksum,
      originalFilename: filename,
      mimeType: payload.mimeType ?? 'text/csv',
      fileSizeBytes: payload.fileSizeBytes ?? payload.buffer.byteLength,
      collectedAt: DateTime.now(),
      rawData,
    })
  }
}
