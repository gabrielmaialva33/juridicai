import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import MarketRate from '#modules/market/models/market_rate'
import MarketRateSeries from '#modules/market/models/market_rate_series'
import marketRateService from '#modules/market/services/market_rate_service'
import { MarketRateFactory } from '#database/factories/market_rate_factory'

test.group('market rate service', () => {
  test('builds an EC 136 correction snapshot from CDI, Selic, and IPCA rates', async ({
    assert,
  }) => {
    const cdiSeries = await rateSeries('cdi', '12', 'daily')
    const selicSeries = await rateSeries('selic', '11', 'daily')
    const ipcaSeries = await rateSeries('ipca', '433', 'monthly')

    await MarketRate.query()
      .whereIn('series_id', [cdiSeries.id, selicSeries.id, ipcaSeries.id])
      .delete()
    await MarketRateFactory.merge({
      seriesId: cdiSeries.id,
      rateDate: DateTime.fromISO('2026-04-30'),
      value: '0.0004800000',
    }).create()
    await MarketRateFactory.merge({
      seriesId: selicSeries.id,
      rateDate: DateTime.fromISO('2026-04-30'),
      value: '0.0004900000',
    }).create()

    for (let index = 0; index < 12; index += 1) {
      await MarketRateFactory.merge({
        seriesId: ipcaSeries.id,
        rateDate: DateTime.fromISO('2026-04-01').minus({ months: index }),
        value: '0.0040000000',
      }).create()
    }

    const snapshot = await marketRateService.latestSnapshot()

    assert.equal(snapshot.asOf, '2026-04-30')
    assert.isAbove(snapshot.selicAnnualRate!, 0.12)
    assert.isBelow(snapshot.ipcaAnnualRate!, 0.06)
    assert.equal(
      snapshot.ec136CorrectionAnnualRate,
      Number((snapshot.ipcaAnnualRate! + 0.02).toFixed(6))
    )

    await MarketRate.query()
      .whereIn('series_id', [cdiSeries.id, selicSeries.id, ipcaSeries.id])
      .delete()
  })
})

function rateSeries(key: 'cdi' | 'selic' | 'ipca', code: string, periodicity: 'daily' | 'monthly') {
  return MarketRateSeries.updateOrCreate(
    { key },
    {
      key,
      code,
      source: 'test',
      periodicity,
      unit: 'decimal_rate',
      description: null,
    }
  )
}
