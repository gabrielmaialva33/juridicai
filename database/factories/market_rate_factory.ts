import { DateTime } from 'luxon'
import factory from '@adonisjs/lucid/factories'
import MarketRate from '#modules/market/models/market_rate'

export const MarketRateFactory = factory
  .define(MarketRate, ({ faker }) => {
    return {
      seriesId: faker.string.uuid(),
      rateDate: DateTime.now(),
      value: '0.0004900000',
      rawData: {},
    }
  })
  .build()
