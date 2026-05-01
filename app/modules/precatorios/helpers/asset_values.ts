import type PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import type AssetValuation from '#modules/precatorios/models/asset_valuation'

export type AssetValueSnapshot = {
  faceValue: number
  estimatedUpdatedValue: number | null
  queuePosition: number | null
}

export function latestAssetValuation(asset: PrecatorioAsset) {
  const valuations = (asset.$preloaded.valuations ?? []) as AssetValuation[]
  return valuations[0] ?? null
}

export function assetValueSnapshot(asset: PrecatorioAsset): AssetValueSnapshot {
  const valuation = latestAssetValuation(asset)
  const faceValue =
    moneyToNumber(valuation?.estimatedUpdatedValue ?? null) ??
    moneyToNumber(valuation?.faceValue ?? null) ??
    0

  return {
    faceValue,
    estimatedUpdatedValue: moneyToNumber(valuation?.estimatedUpdatedValue ?? null),
    queuePosition: valuation?.queuePosition ?? null,
  }
}

export function moneyToNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null
  }

  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}
