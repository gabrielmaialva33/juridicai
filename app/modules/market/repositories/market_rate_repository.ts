import db from '@adonisjs/lucid/services/db'
import MarketRate, { type MarketRateSeriesKey } from '#modules/market/models/market_rate'
import type MarketRateSeries from '#modules/market/models/market_rate_series'
import type { DateTime } from 'luxon'
import type { JsonRecord } from '#shared/types/model_enums'

class MarketRateRepository {
  latestRate(seriesKey: MarketRateSeriesKey) {
    return MarketRate.query()
      .preload('series')
      .whereHas('series', (query) => query.where('key', seriesKey))
      .orderBy('rate_date', 'desc')
      .first()
  }

  latestRates(seriesKey: MarketRateSeriesKey, limit: number) {
    return MarketRate.query()
      .preload('series')
      .whereHas('series', (query) => query.where('key', seriesKey))
      .orderBy('rate_date', 'desc')
      .limit(limit)
  }

  async upsertPoint(
    series: MarketRateSeries,
    point: {
      date: DateTime
      value: number
      raw: JsonRecord
    }
  ) {
    await db
      .table('market_rates')
      .insert({
        series_id: series.id,
        rate_date: point.date.toISODate(),
        value: point.value,
        raw_data: point.raw,
      })
      .onConflict(['series_id', 'rate_date'])
      .merge({
        value: point.value,
        raw_data: point.raw,
        updated_at: new Date(),
      })
  }
}

export default new MarketRateRepository()
