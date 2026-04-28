import { PrecatorioAssetSchema } from '#database/schema'

export default class PrecatorioAsset extends PrecatorioAssetSchema {
  static softDeletes = true
}
