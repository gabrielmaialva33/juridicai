import { DateTime } from 'luxon'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import TenantModel from '#shared/models/tenant_model'
import Beneficiary from '#modules/pii/models/beneficiary'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'

export default class AssetBeneficiary extends TenantModel {
  static table = 'pii.asset_beneficiaries'

  @column()
  declare assetId: string

  @column()
  declare beneficiaryId: string

  @column()
  declare relationshipType: string

  @column()
  declare sharePercent: string | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => PrecatorioAsset, {
    foreignKey: 'assetId',
  })
  declare asset: BelongsTo<typeof PrecatorioAsset>

  @belongsTo(() => Beneficiary)
  declare beneficiary: BelongsTo<typeof Beneficiary>
}
