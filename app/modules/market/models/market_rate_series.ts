import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import MarketRate, {
  type MarketRatePeriodicity,
  type MarketRateSeriesKey,
} from '#modules/market/models/market_rate'

export default class MarketRateSeries extends BaseModel {
  static table = 'market_rate_series'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare key: MarketRateSeriesKey

  @column()
  declare code: string | null

  @column()
  declare source: string

  @column()
  declare periodicity: MarketRatePeriodicity

  @column()
  declare unit: string

  @column()
  declare description: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => MarketRate, {
    foreignKey: 'seriesId',
  })
  declare rates: HasMany<typeof MarketRate>
}
