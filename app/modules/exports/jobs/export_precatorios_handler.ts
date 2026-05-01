import { mkdir, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import ExportJob from '#modules/exports/models/export_job'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import { assetValueSnapshot } from '#modules/precatorios/helpers/asset_values'
import tenantContext from '#shared/helpers/tenant_context'
import jobRunService from '#shared/services/job_run_service'
import type { JsonRecord } from '#shared/types/model_enums'

export const EXPORT_PRECATORIOS_QUEUE = 'exports-precatorios'

export type ExportPrecatoriosPayload = {
  tenantId: string
  exportJobId: string
  requestId?: string | null
  bullmqJobId?: string | null
  attempts?: number | null
  origin?: 'http' | 'manual_retry' | 'system'
}

export async function handleExportPrecatorios(payload: ExportPrecatoriosPayload) {
  const run = await jobRunService.start({
    tenantId: payload.tenantId,
    jobName: 'exports-precatorios',
    queueName: EXPORT_PRECATORIOS_QUEUE,
    bullmqJobId: payload.bullmqJobId ?? null,
    attempts: payload.attempts ?? null,
    origin: payload.origin ?? 'http',
    metadata: {
      exportJobId: payload.exportJobId,
      requestId: payload.requestId ?? null,
    },
  })

  try {
    const result = await tenantContext.run(
      {
        tenantId: payload.tenantId,
        requestId: payload.requestId ?? undefined,
      },
      () => runExport(payload.tenantId, payload.exportJobId)
    )

    await jobRunService.finish(run.id, 'completed', result)

    return result
  } catch (error) {
    await markExportFailed(payload.tenantId, payload.exportJobId, error)
    await jobRunService.finish(run.id, 'failed', null, error)
    throw error
  }
}

async function runExport(tenantId: string, exportJobId: string) {
  const exportJob = await ExportJob.query()
    .where('id', exportJobId)
    .where('tenant_id', tenantId)
    .firstOrFail()

  exportJob.merge({
    status: 'running',
    errorMessage: null,
  })
  await exportJob.save()

  const assets = await PrecatorioAsset.query()
    .where('tenant_id', tenantId)
    .preload('debtor')
    .preload('valuations', (query) => query.orderBy('computed_at', 'desc').limit(1))
    .orderBy('created_at', 'desc')
    .limit(getLimit(exportJob.filters))

  const filePath = await writePrecatorioCsv({
    tenantId,
    exportJobId,
    rows: assets.map((asset) => {
      const value = assetValueSnapshot(asset)

      return {
        external_id: asset.externalId,
        cnj_number: asset.cnjNumber,
        debtor_name: asset.debtor?.name ?? null,
        exercise_year: asset.exerciseYear,
        nature: asset.nature,
        face_value: value.faceValue,
        estimated_updated_value: value.estimatedUpdatedValue,
        lifecycle_status: asset.lifecycleStatus,
        compliance_status: asset.complianceStatus,
        current_score: asset.currentScore,
        source: asset.source,
      }
    }),
  })

  exportJob.merge({
    status: 'completed',
    filePath,
    expiresAt: DateTime.now().plus({ days: 7 }),
  })
  await exportJob.save()

  return {
    exportedRows: assets.length,
    filePath: basename(filePath),
  }
}

async function markExportFailed(tenantId: string, exportJobId: string, error: unknown) {
  const exportJob = await ExportJob.query()
    .where('id', exportJobId)
    .where('tenant_id', tenantId)
    .first()

  if (!exportJob) {
    return
  }

  exportJob.merge({
    status: 'failed',
    errorMessage: error instanceof Error ? error.message : String(error),
  })
  await exportJob.save()
}

async function writePrecatorioCsv(input: {
  tenantId: string
  exportJobId: string
  rows: JsonRecord[]
}) {
  const directory = app.makePath('storage', 'exports', input.tenantId)
  const filePath = app.makePath('storage', 'exports', input.tenantId, `${input.exportJobId}.csv`)
  const headers = [
    'external_id',
    'cnj_number',
    'debtor_name',
    'exercise_year',
    'nature',
    'face_value',
    'estimated_updated_value',
    'lifecycle_status',
    'compliance_status',
    'current_score',
    'source',
  ]
  const contents = [
    headers.join(','),
    ...input.rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\n')

  await mkdir(directory, { recursive: true })
  await writeFile(filePath, contents)

  return filePath
}

function getLimit(filters: JsonRecord | null) {
  const limit = Number(filters?.limit ?? 10_000)
  if (!Number.isFinite(limit)) {
    return 10_000
  }

  return Math.max(1, Math.min(limit, 50_000))
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) {
    return ''
  }

  return `"${String(value).replace(/"/g, '""')}"`
}
