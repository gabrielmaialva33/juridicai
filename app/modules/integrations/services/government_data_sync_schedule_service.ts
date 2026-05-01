import { DateTime } from 'luxon'
import governmentSourceCatalog from '#modules/integrations/services/government_source_catalog'

export const SIOP_OPEN_DATA_START_YEAR = 2008
export const DATAJUD_SCHEDULED_COURT_BATCH_SIZE = 12
export const DATAJUD_SCHEDULED_MAX_PAGES_PER_COURT = 25
export const DJEN_SCHEDULED_MAX_PAGES_PER_COURT = 5
export const DJEN_SCHEDULED_SEARCH_TEXTS = ['precatório', 'RPV'] as const

class GovernmentDataSyncScheduleService {
  buildScheduledPayload(now: DateTime = DateTime.utc()) {
    const courtAliases = this.dataJudCourtBatch(now)

    return {
      years: this.siopBackfillYears(now),
      dataJudCourtAliases: courtAliases,
      dataJudPageSize: 100,
      dataJudMaxPagesPerCourt: DATAJUD_SCHEDULED_MAX_PAGES_PER_COURT,
      djenCourtAliases: courtAliases,
      djenSearchTexts: [...DJEN_SCHEDULED_SEARCH_TEXTS],
      djenStartDate: now.minus({ days: 1 }).toISODate(),
      djenEndDate: now.toISODate(),
      djenMaxPagesPerCourt: DJEN_SCHEDULED_MAX_PAGES_PER_COURT,
      enrichLimit: 1_000,
      linkLimit: 3_000,
      signalLimit: 5_000,
      publicationLimit: 5_000,
      matchLimit: 1_000,
      candidatesPerAsset: 3,
    }
  }

  siopBackfillYears(now: DateTime = DateTime.utc()) {
    const endYear = now.plus({ years: 1 }).year
    const years: number[] = []

    for (let year = SIOP_OPEN_DATA_START_YEAR; year <= endYear; year += 1) {
      years.push(year)
    }

    return years
  }

  dataJudCourtBatch(now: DateTime = DateTime.utc()) {
    const aliases = governmentSourceCatalog.dataJudCourtAliases()
    if (aliases.length === 0) {
      return []
    }

    const batchSize = Math.min(DATAJUD_SCHEDULED_COURT_BATCH_SIZE, aliases.length)
    const start = ((now.ordinal - 1) * batchSize) % aliases.length
    const batch: string[] = []

    for (let index = 0; index < batchSize; index += 1) {
      batch.push(aliases[(start + index) % aliases.length])
    }

    return batch
  }
}

export default new GovernmentDataSyncScheduleService()
