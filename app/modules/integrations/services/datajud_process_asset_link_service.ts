import { DateTime } from 'luxon'
import assetEventRepository from '#modules/precatorios/repositories/asset_event_repository'
import judicialProcessRepository from '#modules/precatorios/repositories/judicial_process_repository'
import judicialProcessSignalRepository from '#modules/precatorios/repositories/judicial_process_signal_repository'
import precatorioRepository from '#modules/precatorios/repositories/precatorio_repository'
import assetSignalScoreService from '#modules/precatorios/services/asset_signal_score_service'
import { normalizeCnj } from '#modules/siop/parsers/cnj_parser'

export type DataJudProcessAssetLinkOptions = {
  tenantId: string
  limit?: number | null
  projectSignals?: boolean
}

export type DataJudProcessAssetLinkMetrics = {
  selectedProcesses: number
  linked: number
  invalidCnj: number
  missingAsset: number
  conflicts: number
  signalEventsProjected: number
  assetScoresRefreshed: number
  assetScoresCreated: number
}

const DEFAULT_LIMIT = 1_000
const MAX_LIMIT = 10_000

class DataJudProcessAssetLinkService {
  async link(options: DataJudProcessAssetLinkOptions): Promise<DataJudProcessAssetLinkMetrics> {
    const processes = await this.findUnlinkedProcesses(options)
    const metrics: DataJudProcessAssetLinkMetrics = {
      selectedProcesses: processes.length,
      linked: 0,
      invalidCnj: 0,
      missingAsset: 0,
      conflicts: 0,
      signalEventsProjected: 0,
      assetScoresRefreshed: 0,
      assetScoresCreated: 0,
    }
    const affectedAssetIds = new Set<string>()

    for (const process of processes) {
      const cnjNumber = normalizeCnj(process.cnjNumber)

      if (!cnjNumber) {
        metrics.invalidCnj += 1
        continue
      }

      const assets = await precatorioRepository.listByCnj(options.tenantId, cnjNumber, 2)

      if (assets.length === 0) {
        metrics.missingAsset += 1
        continue
      }

      if (assets.length > 1) {
        metrics.conflicts += 1
        continue
      }

      const [asset] = assets
      await judicialProcessRepository.setAsset(process, asset.id)
      metrics.linked += 1

      if (options.projectSignals !== false) {
        const projected = await this.projectProcessSignals(options.tenantId, asset.id, process.id)
        metrics.signalEventsProjected += projected
        if (projected > 0) {
          affectedAssetIds.add(asset.id)
        }
      }
    }

    for (const assetId of affectedAssetIds) {
      const result = await assetSignalScoreService.refresh(options.tenantId, assetId)
      metrics.assetScoresRefreshed += 1
      if (result.created) {
        metrics.assetScoresCreated += 1
      }
    }

    return metrics
  }

  private findUnlinkedProcesses(options: DataJudProcessAssetLinkOptions) {
    return judicialProcessRepository.listUnlinkedDataJud(
      options.tenantId,
      normalizeLimit(options.limit)
    )
  }

  private async projectProcessSignals(tenantId: string, assetId: string, processId: string) {
    const signals = await judicialProcessSignalRepository.listByProcess(tenantId, processId)
    let projected = 0

    for (const signal of signals) {
      const idempotencyKey = `datajud-signal:${signal.idempotencyKey}`
      await assetEventRepository.upsertEvent(tenantId, {
        assetId,
        eventType: signal.signalCode,
        eventDate: signal.detectedAt ?? DateTime.utc(),
        source: 'datajud',
        payload: {
          processSignalId: signal.id,
          processId: signal.processId,
          movementId: signal.movementId,
          polarity: signal.polarity,
          confidence: signal.confidence,
          evidence: signal.evidence,
          projectedBy: 'datajud_exact_cnj_link',
        },
        idempotencyKey,
      })
      projected += 1
    }

    return projected
  }
}

function normalizeLimit(value?: number | null) {
  if (!value || value < 1) {
    return DEFAULT_LIMIT
  }

  return Math.min(Math.floor(value), MAX_LIMIT)
}

export const dataJudProcessAssetLinkService = new DataJudProcessAssetLinkService()
export default dataJudProcessAssetLinkService
