import { DateTime } from 'luxon'
import type { MarketRatePeriodicity, MarketRateSeriesKey } from '#modules/market/models/market_rate'

const BCB_SGS_BASE_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs'

export const BCB_SGS_SERIES: Record<
  Exclude<MarketRateSeriesKey, 'ipca_plus_2' | 'ec_136_cap'>,
  {
    code: string
    periodicity: MarketRatePeriodicity
    rawUnit: 'percent_daily' | 'percent_monthly'
  }
> = {
  cdi: {
    code: '12',
    periodicity: 'daily',
    rawUnit: 'percent_daily',
  },
  selic: {
    code: '11',
    periodicity: 'daily',
    rawUnit: 'percent_daily',
  },
  ipca: {
    code: '433',
    periodicity: 'monthly',
    rawUnit: 'percent_monthly',
  },
}

export type BcbSgsPoint = {
  date: DateTime
  value: number
  raw: {
    data: string
    valor: string
  }
}

class BcbSgsAdapter {
  async fetchLatest(seriesKey: keyof typeof BCB_SGS_SERIES, limit = 12) {
    const series = BCB_SGS_SERIES[seriesKey]
    const url = `${BCB_SGS_BASE_URL}.${series.code}/dados/ultimos/${limit}?formato=json`
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`BCB SGS request failed for ${seriesKey}: HTTP ${response.status}`)
    }

    const rows = (await response.json()) as Array<{ data: string; valor: string }>

    return rows.map((row) => ({
      date: DateTime.fromFormat(row.data, 'dd/MM/yyyy'),
      value: Number(row.valor.replace(',', '.')) / 100,
      raw: row,
    }))
  }
}

export const bcbSgsAdapter = new BcbSgsAdapter()
export default bcbSgsAdapter
