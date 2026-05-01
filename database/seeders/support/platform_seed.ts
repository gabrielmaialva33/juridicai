import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import MarketRate from '#modules/market/models/market_rate'
import type Tenant from '#modules/tenant/models/tenant'
import { upsertModel } from './upsert.js'

export async function seedRetentionPolicy(tenant: Tenant) {
  const policies = [
    ['audit_logs', 2555],
    ['pii_access_logs', 2555],
    ['source_records', 3650],
    ['exports', 30],
    ['client_errors', 90],
  ] as const

  for (const [subject, retentionDays] of policies) {
    await db
      .table('retention_config')
      .insert({
        tenant_id: tenant.id,
        subject,
        retention_days: retentionDays,
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflict(['tenant_id', 'subject'])
      .merge({
        retention_days: retentionDays,
        enabled: true,
        updated_at: new Date(),
      })
  }
}

export async function seedMarketRates() {
  const rates = [
    {
      seriesKey: 'cdi' as const,
      seriesCode: '12',
      rateDate: '2026-04-30',
      value: '0.0004800000',
      periodicity: 'daily' as const,
    },
    {
      seriesKey: 'selic' as const,
      seriesCode: '11',
      rateDate: '2026-04-30',
      value: '0.0004900000',
      periodicity: 'daily' as const,
    },
    ...Array.from({ length: 12 }, (_, index) => ({
      seriesKey: 'ipca' as const,
      seriesCode: '433',
      rateDate: DateTime.fromISO('2026-04-01').minus({ months: index }).toISODate()!,
      value: index % 3 === 0 ? '0.0042000000' : '0.0038000000',
      periodicity: 'monthly' as const,
    })),
  ]

  for (const rate of rates) {
    await upsertModel(
      MarketRate,
      {
        seriesKey: rate.seriesKey,
        rateDate: DateTime.fromISO(rate.rateDate),
      },
      {
        seriesCode: rate.seriesCode,
        source: 'seed',
        value: rate.value,
        periodicity: rate.periodicity,
        unit: 'decimal_rate',
        rawData: {
          seed: true,
        },
      }
    )
  }
}
