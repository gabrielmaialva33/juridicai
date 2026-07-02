import MarketRateSeries from '#modules/market/models/market_rate_series'
import type { MarketRatePeriodicity, MarketRateSeriesKey } from '#modules/market/models/market_rate'

class MarketRateSeriesRepository {
  findOrCreate(
    seriesKey: MarketRateSeriesKey,
    input: {
      code: string
      periodicity: MarketRatePeriodicity
    }
  ) {
    return MarketRateSeries.updateOrCreate(
      { key: seriesKey },
      {
        key: seriesKey,
        code: input.code,
        source: 'bcb_sgs',
        periodicity: input.periodicity,
        unit: 'decimal_rate',
        description: null,
      }
    )
  }
}

export default new MarketRateSeriesRepository()
