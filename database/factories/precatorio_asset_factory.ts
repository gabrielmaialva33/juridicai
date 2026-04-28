import factory from '@adonisjs/lucid/factories'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import { DateTime } from 'luxon'
import { DebtorFactory } from '#database/factories/debtor_factory'
import { TenantFactory } from '#database/factories/tenant_factory'

export const PrecatorioAssetFactory = factory
  .define(PrecatorioAsset, async ({ faker }) => {
    const tenant = await TenantFactory.create()
    const debtor = await DebtorFactory.merge({ tenantId: tenant.id }).create()

    return {
      tenantId: tenant.id,
      debtorId: debtor.id,
      source: 'siop',
      externalId: faker.string.uuid(),
      cnjNumber: `${faker.string.numeric(7)}-${faker.string.numeric(2)}.${faker.string.numeric(4)}.4.01.${faker.string.numeric(4)}`,
      nature: 'comum',
      lifecycleStatus: 'unknown',
      piiStatus: 'none',
      complianceStatus: 'pending',
      faceValue: String(faker.number.int({ min: 10_000, max: 5_000_000 })),
      estimatedUpdatedValue: String(faker.number.int({ min: 10_000, max: 6_000_000 })),
      budgetYear: faker.number.int({ min: 2010, max: 2026 }),
      exerciseYear: faker.number.int({ min: 2010, max: 2026 }),
      baseDate: DateTime.now(),
      rawData: {},
    }
  })
  .build()
