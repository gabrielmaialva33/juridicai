import { DateTime } from 'luxon'
import factory from '@adonisjs/lucid/factories'
import MarketRate from '#modules/market/models/market_rate'

export const MarketRateFactory = factory
  .define(MarketRate, () => {
    return {
      seriesKey: 'selic' as const,
      seriesCode: '11',
      source: 'test',
      rateDate: DateTime.now(),
      value: '0.0004900000',
      periodicity: 'daily' as const,
      unit: 'decimal_rate',
      rawData: {},
    }
  })
  .build()
