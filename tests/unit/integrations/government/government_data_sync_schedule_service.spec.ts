import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import governmentDataSyncScheduleService, {
  DATAJUD_SCHEDULED_COURT_BATCH_SIZE,
  DATAJUD_SCHEDULED_MAX_PAGES_PER_COURT,
  DJEN_SCHEDULED_MAX_PAGES_PER_COURT,
  DJEN_SCHEDULED_SEARCH_TEXTS,
  SIOP_OPEN_DATA_START_YEAR,
  TJSP_SCHEDULED_COMMUNICATION_LIMIT,
} from '#modules/integrations/services/government_data_sync_schedule_service'

test.group('Government data sync schedule service', () => {
  test('builds full SIOP backfill years through the next budget year', ({ assert }) => {
    const years = governmentDataSyncScheduleService.siopBackfillYears(
      DateTime.fromISO('2026-05-01T12:00:00Z')
    )

    assert.equal(years[0], SIOP_OPEN_DATA_START_YEAR)
    assert.equal(years.at(-1), 2027)
    assert.include(years, 2024)
    assert.include(years, 2026)
  })

  test('builds rotating DataJud court batches for scheduled automation', ({ assert }) => {
    const firstDay = governmentDataSyncScheduleService.dataJudCourtBatch(
      DateTime.fromISO('2026-01-01T00:00:00Z')
    )
    const secondDay = governmentDataSyncScheduleService.dataJudCourtBatch(
      DateTime.fromISO('2026-01-02T00:00:00Z')
    )
    const payload = governmentDataSyncScheduleService.buildScheduledPayload(
      DateTime.fromISO('2026-05-01T12:00:00Z')
    )

    assert.lengthOf(firstDay, DATAJUD_SCHEDULED_COURT_BATCH_SIZE)
    assert.lengthOf(secondDay, DATAJUD_SCHEDULED_COURT_BATCH_SIZE)
    assert.notDeepEqual(firstDay, secondDay)
    assert.lengthOf(payload.dataJudCourtAliases, DATAJUD_SCHEDULED_COURT_BATCH_SIZE)
    assert.equal(payload.dataJudMaxPagesPerCourt, DATAJUD_SCHEDULED_MAX_PAGES_PER_COURT)
    assert.deepEqual(payload.djenCourtAliases, payload.dataJudCourtAliases)
    assert.deepEqual(payload.djenSearchTexts, [...DJEN_SCHEDULED_SEARCH_TEXTS])
    assert.equal(payload.djenStartDate, '2026-04-30')
    assert.equal(payload.djenEndDate, '2026-05-01')
    assert.equal(payload.djenMaxPagesPerCourt, DJEN_SCHEDULED_MAX_PAGES_PER_COURT)
    assert.deepEqual(payload.tjspCategories, ['state_entities', 'municipal_entities'])
    assert.equal(payload.tjspLimit, TJSP_SCHEDULED_COMMUNICATION_LIMIT)
    assert.equal(payload.years[0], SIOP_OPEN_DATA_START_YEAR)
    assert.equal(payload.years.at(-1), 2027)
  })
})
