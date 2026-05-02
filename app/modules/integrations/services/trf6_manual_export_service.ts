import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import { TRF6_EPROC_FEDERAL_PRECATORIO_EXPORT_URL } from '#modules/integrations/services/trf6_precatorio_adapter'
import sourceEvidenceService from '#modules/integrations/services/source_evidence_service'
import SourceRecord from '#modules/siop/models/source_record'

type PersistTrf6ManualExportPayload = {
  tenantId: string
  exerciseYear: number
  buffer: Buffer
  originalFilename: string
  mimeType?: string | null
  fileSizeBytes?: number | bigint | null
}

class Trf6ManualExportService {
  async persistExport(payload: PersistTrf6ManualExportPayload) {
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
      return { sourceRecord: existing, created: false }
    }

    const sourceRecord = await SourceRecord.create({
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

    return { sourceRecord, created: true }
  }
}

export default new Trf6ManualExportService()
