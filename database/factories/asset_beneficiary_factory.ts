import factory from '@adonisjs/lucid/factories'
import AssetBeneficiary from '#modules/pii/models/asset_beneficiary'
import { BeneficiaryFactory } from '#database/factories/beneficiary_factory'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { TenantFactory } from '#database/factories/tenant_factory'

export const AssetBeneficiaryFactory = factory
  .define(AssetBeneficiary, async () => {
    const tenant = await TenantFactory.create()
    const asset = await PrecatorioAssetFactory.merge({ tenantId: tenant.id }).create()
    const beneficiary = await BeneficiaryFactory.merge({ tenantId: tenant.id }).create()

    return {
      tenantId: tenant.id,
      assetId: asset.id,
      beneficiaryId: beneficiary.id,
    }
  })
  .build()
