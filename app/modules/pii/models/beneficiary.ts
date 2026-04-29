import { column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import TenantBaseModel from '#shared/models/tenant_base_model'
import type { JsonRecord, PiiStatus } from '#shared/types/model_enums'
import AssetBeneficiary from '#modules/pii/models/asset_beneficiary'

export default class Beneficiary extends TenantBaseModel {
  static table = 'pii.beneficiaries'

  @column()
  declare beneficiaryHash: string

  @column({ serializeAs: null })
  declare nameEncrypted: Buffer | null

  @column({ serializeAs: null })
  declare documentEncrypted: Buffer | null

  @column({ serializeAs: null })
  declare emailEncrypted: Buffer | null

  @column({ serializeAs: null })
  declare phoneEncrypted: Buffer | null

  @column()
  declare status: PiiStatus

  @column()
  declare legalBasis: string | null

  @column()
  declare rawMetadata: JsonRecord | null

  @hasMany(() => AssetBeneficiary)
  declare assetBeneficiaries: HasMany<typeof AssetBeneficiary>
}
