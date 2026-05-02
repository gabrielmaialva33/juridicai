import db from '@adonisjs/lucid/services/db'
import dataJudPublicApiAdapter from '#modules/integrations/services/datajud_public_api_adapter'
import { normalizeCnj } from '#modules/siop/parsers/cnj_parser'
import type { JsonRecord, SourceType } from '#shared/types/model_enums'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 1_000

const STATE_COURT_ALIASES: Record<string, string> = {
  '01': 'tjac',
  '02': 'tjal',
  '03': 'tjam',
  '04': 'tjap',
  '05': 'tjba',
  '06': 'tjce',
  '07': 'tjdft',
  '08': 'tjes',
  '09': 'tjgo',
  '10': 'tjma',
  '13': 'tjmg',
  '12': 'tjms',
  '11': 'tjmt',
  '14': 'tjpa',
  '15': 'tjpb',
  '17': 'tjpe',
  '18': 'tjpi',
  '16': 'tjpr',
  '19': 'tjrj',
  '20': 'tjrn',
  '22': 'tjro',
  '23': 'tjrr',
  '21': 'tjrs',
  '24': 'tjsc',
  '25': 'tjse',
  '26': 'tjsp',
  '27': 'tjto',
}

const ELECTORAL_COURT_ALIASES: Record<string, string> = {
  '01': 'tre-ac',
  '02': 'tre-al',
  '03': 'tre-am',
  '04': 'tre-ap',
  '05': 'tre-ba',
  '06': 'tre-ce',
  '07': 'tre-dft',
  '08': 'tre-es',
  '09': 'tre-go',
  '10': 'tre-ma',
  '13': 'tre-mg',
  '12': 'tre-ms',
  '11': 'tre-mt',
  '14': 'tre-pa',
  '15': 'tre-pb',
  '17': 'tre-pe',
  '18': 'tre-pi',
  '16': 'tre-pr',
  '19': 'tre-rj',
  '20': 'tre-rn',
  '22': 'tre-ro',
  '23': 'tre-rr',
  '21': 'tre-rs',
  '24': 'tre-sc',
  '25': 'tre-se',
  '26': 'tre-sp',
  '27': 'tre-to',
}

const STATE_MILITARY_COURT_ALIASES: Record<string, string> = {
  '13': 'tjmmg',
  '21': 'tjmrs',
  '26': 'tjmsp',
}

type CandidateRow = {
  id: string
  cnj_number: string | null
  source: SourceType
}

export type DataJudAssetEnrichmentOptions = {
  tenantId: string
  sourceRecordId?: string | null
  limit?: number | null
  source?: SourceType | null
  missingOnly?: boolean
  courtAliases?: string[] | null
  dryRun?: boolean
  fetcher?: typeof fetch
  apiKey?: string
}

export type DataJudAssetEnrichmentMetrics = {
  selected: number
  attempted: number
  synced: number
  skippedExisting: number
  invalidCnj: number
  noCourt: number
  errors: number
  dryRun: boolean
  failures: JsonRecord[]
}

class DataJudAssetEnrichmentService {
  async enrich(options: DataJudAssetEnrichmentOptions): Promise<DataJudAssetEnrichmentMetrics> {
    const missingOnly = options.missingOnly ?? true
    const candidates = await this.findCandidates(options)
    const metrics: DataJudAssetEnrichmentMetrics = {
      selected: candidates.length,
      attempted: 0,
      synced: 0,
      skippedExisting: 0,
      invalidCnj: 0,
      noCourt: 0,
      errors: 0,
      dryRun: options.dryRun ?? false,
      failures: [],
    }

    for (const candidate of candidates) {
      if (missingOnly && (await this.hasJudicialProcess(candidate.id))) {
        metrics.skippedExisting += 1
        continue
      }

      const cnjNumber = normalizeCnj(candidate.cnj_number)
      if (!cnjNumber) {
        metrics.invalidCnj += 1
        continue
      }

      const courtAliases =
        normalizeAliases(options.courtAliases) ?? inferDataJudCourtAliases(cnjNumber)
      if (courtAliases.length === 0) {
        metrics.noCourt += 1
        continue
      }

      if (options.dryRun) {
        metrics.attempted += 1
        continue
      }

      try {
        metrics.attempted += 1
        const result = await dataJudPublicApiAdapter.syncByCnj({
          tenantId: options.tenantId,
          cnjNumber,
          courtAliases,
          fetcher: options.fetcher,
          apiKey: options.apiKey,
        })
        metrics.synced += result.synced
      } catch (error) {
        metrics.errors += 1
        metrics.failures.push({
          assetId: candidate.id,
          cnjNumber,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return metrics
  }

  private findCandidates(options: DataJudAssetEnrichmentOptions) {
    const query = db
      .from('precatorio_assets')
      .select('id', 'cnj_number', 'source')
      .where('tenant_id', options.tenantId)
      .whereNull('deleted_at')
      .whereNotNull('cnj_number')
      .orderBy('created_at', 'asc')
      .limit(normalizeLimit(options.limit))

    if (options.source) {
      query.where('source', options.source)
    }

    if (options.sourceRecordId) {
      query.where('source_record_id', options.sourceRecordId)
    }

    if (options.missingOnly ?? true) {
      query.whereNotExists((subquery) => {
        subquery
          .from('judicial_processes')
          .select(db.raw('1'))
          .whereColumn('judicial_processes.asset_id', 'precatorio_assets.id')
          .whereNull('judicial_processes.deleted_at')
      })
    }

    return query as Promise<CandidateRow[]>
  }

  private async hasJudicialProcess(assetId: string) {
    const [row] = await db
      .from('judicial_processes')
      .where('asset_id', assetId)
      .whereNull('deleted_at')
      .count('* as total')

    return Number(row.total) > 0
  }
}

export function inferDataJudCourtAliases(cnjNumber: string) {
  const digits = cnjNumber.replace(/\D/g, '')
  const segment = digits.slice(13, 14)
  const court = digits.slice(14, 16)

  if (segment === '3') {
    return ['stj']
  }

  if (segment === '4') {
    return [`trf${Number(court)}`]
  }

  if (segment === '5') {
    return [`trt${Number(court)}`]
  }

  if (segment === '6') {
    return ELECTORAL_COURT_ALIASES[court] ? [ELECTORAL_COURT_ALIASES[court]] : []
  }

  if (segment === '7') {
    return ['stm']
  }

  if (segment === '8') {
    return STATE_COURT_ALIASES[court] ? [STATE_COURT_ALIASES[court]] : []
  }

  if (segment === '9') {
    return STATE_MILITARY_COURT_ALIASES[court] ? [STATE_MILITARY_COURT_ALIASES[court]] : []
  }

  return []
}

export function normalizeAliases(value?: string[] | null) {
  if (!value || value.length === 0) {
    return null
  }

  return value.map((alias) => alias.trim().toLowerCase()).filter(Boolean)
}

function normalizeLimit(limit?: number | null) {
  if (!limit || limit < 1) {
    return DEFAULT_LIMIT
  }

  return Math.min(Math.floor(limit), MAX_LIMIT)
}

export default new DataJudAssetEnrichmentService()
