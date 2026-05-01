import factory from '@adonisjs/lucid/factories'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import { DateTime } from 'luxon'
import AssetBudgetFact from '#modules/precatorios/models/asset_budget_fact'
import AssetValuation from '#modules/precatorios/models/asset_valuation'
import BudgetUnit from '#modules/reference/models/budget_unit'
import Court from '#modules/reference/models/court'
import { DebtorFactory } from '#database/factories/debtor_factory'
import { ensureTenantId } from '#database/factories/factory_helpers'

type AssetFactoryRow = Partial<PrecatorioAsset> & {
  faceValue?: string | null
  estimatedUpdatedValue?: string | null
  baseDate?: DateTime | null
  queuePosition?: number | null
  courtCode?: string | null
  courtName?: string | null
  courtClass?: string | null
  budgetUnitCode?: string | null
  budgetUnitName?: string | null
  causeType?: string | null
}

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
    } as AssetFactoryRow
  })
  .before('create', async (_, row) => {
    const assetRow = row as AssetFactoryRow
    const tenantId = await ensureTenantId(row)
    row.$extras.factoryValuation = {
      faceValue: assetRow.faceValue ?? null,
      estimatedUpdatedValue: assetRow.estimatedUpdatedValue ?? assetRow.faceValue ?? null,
      baseDate: assetRow.baseDate ?? DateTime.now(),
      queuePosition: assetRow.queuePosition ?? null,
    }
    row.$extras.factoryBudgetFact = {
      budgetUnitCode: assetRow.budgetUnitCode ?? null,
      budgetUnitName: assetRow.budgetUnitName ?? null,
      causeType: assetRow.causeType ?? null,
    }

    if (!row.debtorId) {
      const debtor = await DebtorFactory.merge({ tenantId }).create()
      row.debtorId = debtor.id
    }

    if (!row.courtId && assetRow.courtCode && assetRow.courtName) {
      const court = await Court.updateOrCreate(
        { code: assetRow.courtCode },
        {
          code: assetRow.courtCode,
          alias: null,
          name: assetRow.courtName,
          courtClass: assetRow.courtClass ?? null,
        }
      )
      row.courtId = court.id
    }

    delete assetRow.faceValue
    delete assetRow.estimatedUpdatedValue
    delete assetRow.baseDate
    delete assetRow.queuePosition
    delete assetRow.courtCode
    delete assetRow.courtName
    delete assetRow.courtClass
    delete assetRow.budgetUnitCode
    delete assetRow.budgetUnitName
    delete assetRow.causeType
  })
  .after('create', async (_, model) => {
    const valuation = model.$extras.factoryValuation as {
      faceValue: string | null
      estimatedUpdatedValue: string | null
      baseDate: DateTime | null
      queuePosition: number | null
    }
    await AssetValuation.create({
      tenantId: model.tenantId,
      assetId: model.id,
      faceValue: valuation.faceValue,
      estimatedUpdatedValue: valuation.estimatedUpdatedValue,
      baseDate: valuation.baseDate,
      queuePosition: valuation.queuePosition,
      rawData: { factory: true },
    })

    const budgetFact = model.$extras.factoryBudgetFact as {
      budgetUnitCode: string | null
      budgetUnitName: string | null
      causeType: string | null
    }
    const budgetUnit =
      budgetFact.budgetUnitCode && budgetFact.budgetUnitName
        ? await BudgetUnit.updateOrCreate(
            { code: budgetFact.budgetUnitCode },
            { code: budgetFact.budgetUnitCode, name: budgetFact.budgetUnitName }
          )
        : null

    if (budgetUnit || budgetFact.causeType) {
      await AssetBudgetFact.create({
        tenantId: model.tenantId,
        assetId: model.id,
        exerciseYear: model.exerciseYear,
        budgetYear: model.budgetYear,
        budgetUnitId: budgetUnit?.id ?? null,
        causeType: budgetFact.causeType,
        rawData: { factory: true },
      })
    }
  })
  .build()
