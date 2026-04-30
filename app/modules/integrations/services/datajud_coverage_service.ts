import db from '@adonisjs/lucid/services/db'
import { inferDataJudCourtAliases } from '#modules/integrations/services/datajud_asset_enrichment_service'
import { normalizeCnj } from '#modules/siop/parsers/cnj_parser'
import type { SourceType } from '#shared/types/model_enums'

type CoverageRow = {
  id: string
  source: SourceType
  cnj_number: string | null
  judicial_process_id: string | null
}

type GroupMetrics = {
  assetsTotal: number
  assetsWithCnj: number
  assetsWithJudicialProcess: number
  missingCourtInference: number
  coveragePercent: number
}

export type DataJudCoverageReport = GroupMetrics & {
  tenantId: string
  source: SourceType | null
  bySource: Record<string, GroupMetrics>
  byCourtAlias: Record<string, GroupMetrics>
}

class DataJudCoverageService {
  async report(input: { tenantId: string; source?: SourceType | null }) {
    const rows = await this.fetchRows(input.tenantId, input.source)
    const bySource: Record<string, GroupAccumulator> = {}
    const byCourtAlias: Record<string, GroupAccumulator> = {}
    const total = createAccumulator()

    for (const row of rows) {
      const source = row.source
      const cnjNumber = normalizeCnj(row.cnj_number)
      const hasProcess = Boolean(cnjNumber && row.judicial_process_id)
      const courtAliases = cnjNumber ? inferDataJudCourtAliases(cnjNumber) : []

      accumulate(total, cnjNumber, hasProcess, courtAliases)
      accumulate((bySource[source] ??= createAccumulator()), cnjNumber, hasProcess, courtAliases)

      if (courtAliases.length === 0) {
        accumulate(
          (byCourtAlias.unknown ??= createAccumulator()),
          cnjNumber,
          hasProcess,
          courtAliases
        )
        continue
      }

      for (const courtAlias of courtAliases) {
        accumulate(
          (byCourtAlias[courtAlias] ??= createAccumulator()),
          cnjNumber,
          hasProcess,
          courtAliases
        )
      }
    }

    return {
      tenantId: input.tenantId,
      source: input.source ?? null,
      ...finalize(total),
      bySource: finalizeGroups(bySource),
      byCourtAlias: finalizeGroups(byCourtAlias),
    } satisfies DataJudCoverageReport
  }

  private fetchRows(tenantId: string, source?: SourceType | null) {
    const query = db
      .from('precatorio_assets')
      .leftJoin('judicial_processes', (join) => {
        join
          .on('judicial_processes.asset_id', 'precatorio_assets.id')
          .andOnNull('judicial_processes.deleted_at')
      })
      .select(
        'precatorio_assets.id',
        'precatorio_assets.source',
        'precatorio_assets.cnj_number',
        'judicial_processes.id as judicial_process_id'
      )
      .where('precatorio_assets.tenant_id', tenantId)
      .whereNull('precatorio_assets.deleted_at')

    if (source) {
      query.where('precatorio_assets.source', source)
    }

    return query as Promise<CoverageRow[]>
  }
}

type GroupAccumulator = {
  assetsTotal: number
  assetsWithCnj: number
  assetsWithJudicialProcess: number
  missingCourtInference: number
}

function createAccumulator(): GroupAccumulator {
  return {
    assetsTotal: 0,
    assetsWithCnj: 0,
    assetsWithJudicialProcess: 0,
    missingCourtInference: 0,
  }
}

function accumulate(
  accumulator: GroupAccumulator,
  cnjNumber: string | null,
  hasJudicialProcess: boolean,
  courtAliases: string[]
) {
  accumulator.assetsTotal += 1

  if (cnjNumber) {
    accumulator.assetsWithCnj += 1
  }

  if (hasJudicialProcess) {
    accumulator.assetsWithJudicialProcess += 1
  }

  if (cnjNumber && courtAliases.length === 0) {
    accumulator.missingCourtInference += 1
  }
}

function finalize(accumulator: GroupAccumulator): GroupMetrics {
  return {
    ...accumulator,
    coveragePercent:
      accumulator.assetsWithCnj === 0
        ? 0
        : roundPercent((accumulator.assetsWithJudicialProcess / accumulator.assetsWithCnj) * 100),
  }
}

function finalizeGroups(groups: Record<string, GroupAccumulator>) {
  return Object.fromEntries(
    Object.entries(groups)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, finalize(value)])
  )
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100
}

export default new DataJudCoverageService()
