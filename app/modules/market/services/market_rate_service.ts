import db from '@adonisjs/lucid/services/db'
import MarketRate, { type MarketRateSeriesKey } from '#modules/market/models/market_rate'
import bcbSgsAdapter, { BCB_SGS_SERIES } from '#modules/market/services/bcb_sgs_adapter'

export type MarketRateSnapshot = {
  cdiAnnualRate: number | null
  selicAnnualRate: number | null
  ipcaAnnualRate: number | null
  ec136CorrectionAnnualRate: number
  asOf: string | null
  sources: Array<{
    seriesKey: MarketRateSeriesKey
    seriesCode: string | null
    rateDate: string
    value: number
    periodicity: string
    source: string
  }>
}

class MarketRateService {
  async latestSnapshot(): Promise<MarketRateSnapshot> {
    const [cdi, selic, ipcaRows] = await Promise.all([
      latestRate('cdi'),
      latestRate('selic'),
      latestRates('ipca', 12),
    ])
    const cdiAnnualRate = cdi ? annualizeDailyRate(rateValue(cdi)) : null
    const selicAnnualRate = selic ? annualizeDailyRate(rateValue(selic)) : null
    const ipcaAnnualRate = ipcaRows.length > 0 ? compound(ipcaRows.map(rateValue)) - 1 : null
    const ipcaPlusTwo = ipcaAnnualRate !== null ? ipcaAnnualRate + 0.02 : null
    const ec136CorrectionAnnualRate =
      ipcaPlusTwo !== null && selicAnnualRate !== null
        ? Math.min(ipcaPlusTwo, selicAnnualRate)
        : (selicAnnualRate ?? ipcaPlusTwo ?? 0.12)
    const sourceRows = [cdi, selic, ...ipcaRows].filter((row): row is MarketRate => Boolean(row))
    const asOf = latestDate(sourceRows)

    return {
      cdiAnnualRate: roundRate(cdiAnnualRate),
      selicAnnualRate: roundRate(selicAnnualRate),
      ipcaAnnualRate: roundRate(ipcaAnnualRate),
      ec136CorrectionAnnualRate: roundRate(ec136CorrectionAnnualRate) ?? 0.12,
      asOf,
      sources: sourceRows.map((row) => ({
        seriesKey: row.seriesKey,
        seriesCode: row.seriesCode,
        rateDate: row.rateDate.toISODate()!,
        value: rateValue(row),
        periodicity: row.periodicity,
        source: row.source,
      })),
    }
  }

  async syncFromBcb(
    input: { seriesKeys?: Array<keyof typeof BCB_SGS_SERIES>; limit?: number } = {}
  ) {
    const seriesKeys = input.seriesKeys ?? ['cdi', 'selic', 'ipca']
    const limit = input.limit ?? 12
    const stats = {
      fetched: 0,
      upserted: 0,
    }

    for (const seriesKey of seriesKeys) {
      const points = await bcbSgsAdapter.fetchLatest(seriesKey, limit)
      const series = BCB_SGS_SERIES[seriesKey]

      stats.fetched += points.length

      for (const point of points) {
        await db
          .table('market_rates')
          .insert({
            series_key: seriesKey,
            series_code: series.code,
            source: 'bcb_sgs',
            rate_date: point.date.toISODate(),
            value: point.value,
            periodicity: series.periodicity,
            unit: 'decimal_rate',
            raw_data: point.raw,
          })
          .onConflict(['series_key', 'rate_date'])
          .merge({
            value: point.value,
            raw_data: point.raw,
            updated_at: new Date(),
          })

        stats.upserted += 1
      }
    }

    return stats
  }
}

function latestRate(seriesKey: MarketRateSeriesKey) {
  return MarketRate.query().where('series_key', seriesKey).orderBy('rate_date', 'desc').first()
}

function latestRates(seriesKey: MarketRateSeriesKey, limit: number) {
  return MarketRate.query().where('series_key', seriesKey).orderBy('rate_date', 'desc').limit(limit)
}

function annualizeDailyRate(rate: number) {
  return Math.pow(1 + rate, 252) - 1
}

function compound(rates: number[]) {
  return rates.reduce((accumulator, rate) => accumulator * (1 + rate), 1)
}

function rateValue(rate: MarketRate) {
  return Number(rate.value)
}

function latestDate(rates: MarketRate[]) {
  return rates
    .map((rate) => rate.rateDate)
    .sort((left, right) => right.toMillis() - left.toMillis())[0]
    ?.toISODate()
}

function roundRate(value: number | null) {
  return value === null ? null : Number(value.toFixed(6))
}

export const marketRateService = new MarketRateService()
export default marketRateService
