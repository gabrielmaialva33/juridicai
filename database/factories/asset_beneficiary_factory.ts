import factory from '@adonisjs/lucid/factories'
import AssetBeneficiary from '#modules/pii/models/asset_beneficiary'
import { BeneficiaryFactory } from '#database/factories/beneficiary_factory'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { ensureTenantId } from '#database/factories/factory_helpers'

export const AssetBeneficiaryFactory = factory
  .define(AssetBeneficiary, async () => {
    return {
      relationshipType: 'beneficiary',
      sharePercent: null,
    }
  })
  .before('create', async (_, row) => {
    const tenantId = await ensureTenantId(row)

    if (!row.assetId) {
      const asset = await PrecatorioAssetFactory.merge({ tenantId }).create()
      row.assetId = asset.id
    }

    if (!row.beneficiaryId) {
      const beneficiary = await BeneficiaryFactory.merge({ tenantId }).create()
      row.beneficiaryId = beneficiary.id
    }
  })
  .build()
