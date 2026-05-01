import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import MarketRate from '#modules/market/models/market_rate'
import marketRateService from '#modules/market/services/market_rate_service'
import { MarketRateFactory } from '#database/factories/market_rate_factory'

test.group('market rate service', () => {
  test('builds an EC 136 correction snapshot from CDI, Selic, and IPCA rates', async ({
    assert,
  }) => {
    await MarketRate.query().whereIn('series_key', ['cdi', 'selic', 'ipca']).delete()
    await MarketRateFactory.merge({
      seriesKey: 'cdi',
      seriesCode: '12',
      rateDate: DateTime.fromISO('2026-04-30'),
      value: '0.0004800000',
      periodicity: 'daily',
    }).create()
    await MarketRateFactory.merge({
      seriesKey: 'selic',
      seriesCode: '11',
      rateDate: DateTime.fromISO('2026-04-30'),
      value: '0.0004900000',
      periodicity: 'daily',
    }).create()

    for (let index = 0; index < 12; index += 1) {
      await MarketRateFactory.merge({
        seriesKey: 'ipca',
        seriesCode: '433',
        rateDate: DateTime.fromISO('2026-04-01').minus({ months: index }),
        value: '0.0040000000',
        periodicity: 'monthly',
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

    await MarketRate.query().whereIn('series_key', ['cdi', 'selic', 'ipca']).delete()
  })
})
