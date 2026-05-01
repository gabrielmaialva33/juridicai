import { DateTime } from 'luxon'
import factory from '@adonisjs/lucid/factories'
import DebtorPaymentStat from '#modules/debtors/models/debtor_payment_stat'
import { DebtorFactory } from '#database/factories/debtor_factory'
import { ensureTenantId } from '#database/factories/factory_helpers'

export const DebtorPaymentStatFactory = factory
  .define(DebtorPaymentStat, () => {
    return {
      periodStart: DateTime.now().minus({ years: 5 }),
      periodEnd: DateTime.now(),
      sampleSize: 100,
      averagePaymentMonths: 18,
      onTimePaymentRate: '0.920000',
      paidVolume: '100000000.00',
      openDebtStock: '500000000.00',
      rclDebtRatio: '0.038000',
      regimeSpecialActive: false,
      recentDefault: false,
      reliabilityScore: 92,
      source: 'test',
      rawData: {},
    }
  })
  .before('create', async (_, row) => {
    const tenantId = await ensureTenantId(row)

    if (!row.debtorId) {
      const debtor = await DebtorFactory.merge({ tenantId }).create()
      row.debtorId = debtor.id
    }
  })
  .build()
