import factory from '@adonisjs/lucid/factories'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import { DateTime } from 'luxon'
import { DebtorFactory } from '#database/factories/debtor_factory'
import { ensureTenantId } from '#database/factories/factory_helpers'

export const PrecatorioAssetFactory = factory
  .define(PrecatorioAsset, async ({ faker }) => {
    return {
      source: 'siop' as const,
      externalId: faker.string.uuid(),
      cnjNumber: `${faker.string.numeric(7)}-${faker.string.numeric(2)}.${faker.string.numeric(4)}.4.01.${faker.string.numeric(4)}`,
      nature: 'comum' as const,
      lifecycleStatus: 'unknown' as const,
      piiStatus: 'none' as const,
      complianceStatus: 'pending' as const,
      faceValue: String(faker.number.int({ min: 10_000, max: 5_000_000 })),
      estimatedUpdatedValue: String(faker.number.int({ min: 10_000, max: 6_000_000 })),
      budgetYear: faker.number.int({ min: 2010, max: 2026 }),
      exerciseYear: faker.number.int({ min: 2010, max: 2026 }),
      baseDate: DateTime.now(),
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
