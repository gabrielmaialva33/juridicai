import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { JsonRecord } from '#shared/types/model_enums'
import MarketRateSeries from '#modules/market/models/market_rate_series'

export type MarketRateSeriesKey = 'cdi' | 'selic' | 'ipca' | 'ipca_plus_2' | 'ec_136_cap'
export type MarketRatePeriodicity = 'daily' | 'monthly' | 'annual' | 'derived'

export default class MarketRate extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare seriesId: string | null

  @column()
  declare seriesKey: MarketRateSeriesKey

  @column()
  declare seriesCode: string | null

  @column()
  declare source: string

  @column.date()
  declare rateDate: DateTime

  @column()
  declare value: string

  @column()
  declare periodicity: MarketRatePeriodicity

  @column()
  declare unit: string

  @column()
  declare rawData: JsonRecord | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => MarketRateSeries, {
    foreignKey: 'seriesId',
  })
  declare series: BelongsTo<typeof MarketRateSeries>
}
