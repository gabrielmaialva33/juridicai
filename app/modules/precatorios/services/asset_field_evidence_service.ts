import { DateTime } from 'luxon'
import assetIntelligenceDossierService from '#modules/operations/services/asset_intelligence_dossier_service'
import type { AssetFieldEvidenceStatus } from '#modules/precatorios/models/asset_field_evidence'
import assetFieldEvidenceRepository from '#modules/precatorios/repositories/asset_field_evidence_repository'
import type {
  AssetSourceLinkType,
  ExternalIdentifierType,
  JsonRecord,
  SourceType,
} from '#shared/types/model_enums'

type Dossier = Awaited<ReturnType<typeof assetIntelligenceDossierService.build>>

type FieldEvidenceCandidate = {
  fieldKey: FieldKey
  value: unknown
  source: SourceType | null
  sourceRecordId: string | null
  sourceDatasetId: string | null
  confidence: number
  weight: number
  reason: string
}

type MaterializeOptions = {
  dryRun?: boolean
  computedAt?: DateTime
}

export type MaterializedAssetFieldEvidence = {
  fieldKey: FieldKey
  canonicalValue: string | null
  canonicalSource: SourceType | null
  canonicalSourceRecordId: string | null
  canonicalSourceDatasetId: string | null
  confidence: number
  status: AssetFieldEvidenceStatus
  evidenceCount: number
  conflictingValues: JsonRecord[]
  evidence: JsonRecord[]
}

export type AssetFieldEvidenceMaterializeResult = {
  tenantId: string
  assetId: string
  dryRun: boolean
  totalFields: number
  resolvedFields: number
  conflictFields: number
  missingFields: number
  rows: MaterializedAssetFieldEvidence[]
}

type FieldKey =
  | 'cnj_number'
  | 'origin_process_number'
  | 'asset_number'
  | 'debtor_name'
  | 'debtor_state_code'
  | 'court_alias'
  | 'court_code'
  | 'budget_unit_code'
  | 'nature'
  | 'lifecycle_status'
  | 'exercise_year'
  | 'budget_year'
  | 'face_value'
  | 'estimated_updated_value'
  | 'queue_position'

const FIELD_KEYS: FieldKey[] = [
  'cnj_number',
  'origin_process_number',
  'asset_number',
  'debtor_name',
  'debtor_state_code',
  'court_alias',
  'court_code',
  'budget_unit_code',
  'nature',
  'lifecycle_status',
  'exercise_year',
  'budget_year',
  'face_value',
  'estimated_updated_value',
  'queue_position',
]

const IDENTIFIER_FIELD_MAP: Partial<Record<ExternalIdentifierType, FieldKey>> = {
  cnj_number: 'cnj_number',
  origin_process_number: 'origin_process_number',
  asset_number: 'asset_number',
  precatorio_number: 'asset_number',
  requisition_number: 'asset_number',
  chronological_order: 'queue_position',
}

class AssetFieldEvidenceService {
  async materialize(
    tenantId: string,
    assetId: string,
    options: MaterializeOptions = {}
  ): Promise<AssetFieldEvidenceMaterializeResult> {
    const dossier = await assetIntelligenceDossierService.build(tenantId, assetId)
    const computedAt = options.computedAt ?? DateTime.utc()
    const rows = FIELD_KEYS.map((fieldKey) =>
      resolveField(fieldKey, collectCandidates(fieldKey, dossier))
    )

    if (!options.dryRun) {
      for (const row of rows) {
        await assetFieldEvidenceRepository.upsertResolvedField(tenantId, {
          assetId,
          ...row,
          computedAt,
        })
      }
    }

    return {
      tenantId,
      assetId,
      dryRun: options.dryRun ?? false,
      totalFields: rows.length,
      resolvedFields: rows.filter((row) => row.status === 'resolved').length,
      conflictFields: rows.filter((row) => row.status === 'conflict').length,
      missingFields: rows.filter((row) => row.status === 'missing').length,
      rows,
    }
  }
}

function collectCandidates(fieldKey: FieldKey, dossier: Dossier) {
  const candidates: FieldEvidenceCandidate[] = []
  const sourceRecordById = new Map(
    dossier.evidenceGraph.sourceRecords.map((record) => [record.id, record])
  )
  const sourceDatasetIdFor = (sourceRecordId: string | null) =>
    sourceRecordId ? (sourceRecordById.get(sourceRecordId)?.sourceDatasetId ?? null) : null

  addCanonicalCandidates(candidates, fieldKey, dossier, sourceDatasetIdFor)
  addIdentifierCandidates(candidates, fieldKey, dossier, sourceDatasetIdFor)
  addSourceLinkCandidates(candidates, fieldKey, dossier, sourceRecordById)
  addProcessCandidates(candidates, fieldKey, dossier, sourceDatasetIdFor)
  addFinancialCandidates(candidates, fieldKey, dossier, sourceDatasetIdFor)

  return candidates.filter((candidate) => normalizeValue(fieldKey, candidate.value) !== null)
}

function addCanonicalCandidates(
  candidates: FieldEvidenceCandidate[],
  fieldKey: FieldKey,
  dossier: Dossier,
  sourceDatasetIdFor: (sourceRecordId: string | null) => string | null
) {
  const identity = dossier.canonicalIdentity
  const sourceRecordId = dossier.relationshipMap.primarySourceRecordId

  addCandidate(candidates, {
    fieldKey,
    value: valueFromCanonicalIdentity(fieldKey, dossier),
    source: identity.source,
    sourceRecordId,
    sourceDatasetId: sourceDatasetIdFor(sourceRecordId),
    confidence: 0.95,
    weight: 95,
    reason: 'canonical_asset_identity',
  })
}

function addIdentifierCandidates(
  candidates: FieldEvidenceCandidate[],
  fieldKey: FieldKey,
  dossier: Dossier,
  sourceDatasetIdFor: (sourceRecordId: string | null) => string | null
) {
  for (const identifier of dossier.canonicalIdentity.identifiers) {
    const mappedField = IDENTIFIER_FIELD_MAP[identifier.type as ExternalIdentifierType]
    if (mappedField !== fieldKey) continue

    addCandidate(candidates, {
      fieldKey,
      value: identifier.value,
      source: sourceFromRecord(dossier, identifier.sourceRecordId),
      sourceRecordId: identifier.sourceRecordId,
      sourceDatasetId: identifier.sourceDatasetId ?? sourceDatasetIdFor(identifier.sourceRecordId),
      confidence: identifier.confidence,
      weight: identifier.isPrimary ? 100 : 75,
      reason: identifier.isPrimary ? 'primary_external_identifier' : 'external_identifier',
    })
  }
}

function addSourceLinkCandidates(
  candidates: FieldEvidenceCandidate[],
  fieldKey: FieldKey,
  dossier: Dossier,
  sourceRecordById: Map<string, Dossier['evidenceGraph']['sourceRecords'][number]>
) {
  for (const link of dossier.evidenceGraph.sourceLinks) {
    const payload = link.normalizedPayload
    const value = payload ? valueFromPayload(fieldKey, payload) : null
    if (value === null) continue

    const sourceRecord = sourceRecordById.get(link.sourceRecordId)

    addCandidate(candidates, {
      fieldKey,
      value,
      source: sourceRecord?.source ?? null,
      sourceRecordId: link.sourceRecordId,
      sourceDatasetId: link.sourceDatasetId ?? sourceRecord?.sourceDatasetId ?? null,
      confidence: link.confidence,
      weight: sourceLinkWeight(link.linkType as AssetSourceLinkType),
      reason: `source_link_${link.linkType}`,
    })
  }
}

function addProcessCandidates(
  candidates: FieldEvidenceCandidate[],
  fieldKey: FieldKey,
  dossier: Dossier,
  sourceDatasetIdFor: (sourceRecordId: string | null) => string | null
) {
  if (!['cnj_number', 'court_alias', 'court_code'].includes(fieldKey)) return

  for (const process of dossier.processIntelligence.linkedProcesses) {
    const value =
      fieldKey === 'cnj_number'
        ? process.cnjNumber
        : fieldKey === 'court_alias'
          ? (process.courtAlias ?? process.court?.alias)
          : process.court?.code

    addCandidate(candidates, {
      fieldKey,
      value,
      source: process.source as SourceType,
      sourceRecordId: process.sourceRecordId,
      sourceDatasetId: sourceDatasetIdFor(process.sourceRecordId),
      confidence: 0.9,
      weight: 85,
      reason: 'linked_judicial_process',
    })
  }
}

function addFinancialCandidates(
  candidates: FieldEvidenceCandidate[],
  fieldKey: FieldKey,
  dossier: Dossier,
  sourceDatasetIdFor: (sourceRecordId: string | null) => string | null
) {
  const latestValuation = dossier.financialIntelligence.latestValuation
  if (latestValuation) {
    const value =
      fieldKey === 'face_value'
        ? latestValuation.faceValue
        : fieldKey === 'estimated_updated_value'
          ? latestValuation.estimatedUpdatedValue
          : fieldKey === 'queue_position'
            ? latestValuation.queuePosition
            : null

    addCandidate(candidates, {
      fieldKey,
      value,
      source: sourceFromRecord(dossier, latestValuation.sourceRecordId),
      sourceRecordId: latestValuation.sourceRecordId,
      sourceDatasetId: sourceDatasetIdFor(latestValuation.sourceRecordId),
      confidence: 0.9,
      weight: 90,
      reason: 'latest_asset_valuation',
    })
  }

  const latestBudgetFact = dossier.financialIntelligence.budgetFacts[0]
  if (!latestBudgetFact) return

  const value =
    fieldKey === 'exercise_year'
      ? latestBudgetFact.exerciseYear
      : fieldKey === 'budget_year'
        ? latestBudgetFact.budgetYear
        : fieldKey === 'budget_unit_code'
          ? latestBudgetFact.budgetUnitId
          : null

  addCandidate(candidates, {
    fieldKey,
    value,
    source: sourceFromRecord(dossier, latestBudgetFact.sourceRecordId),
    sourceRecordId: latestBudgetFact.sourceRecordId,
    sourceDatasetId: sourceDatasetIdFor(latestBudgetFact.sourceRecordId),
    confidence: 0.75,
    weight: 70,
    reason: 'latest_budget_fact',
  })
}

function resolveField(
  fieldKey: FieldKey,
  candidates: FieldEvidenceCandidate[]
): MaterializedAssetFieldEvidence {
  const evidence = candidates.map((candidate) => evidencePayload(fieldKey, candidate))
  const groups = groupCandidates(fieldKey, candidates)

  if (groups.size === 0) {
    return {
      fieldKey,
      canonicalValue: null,
      canonicalSource: null,
      canonicalSourceRecordId: null,
      canonicalSourceDatasetId: null,
      confidence: 0,
      status: 'missing',
      evidenceCount: 0,
      conflictingValues: [],
      evidence,
    }
  }

  const rankedGroups = [...groups.values()].sort((left, right) => right.score - left.score)
  const canonicalGroup = rankedGroups[0]
  const canonicalCandidate = canonicalGroup.candidates.sort(
    (left, right) => candidateScore(right) - candidateScore(left)
  )[0]
  const totalScore = rankedGroups.reduce((sum, group) => sum + group.score, 0)
  const status: AssetFieldEvidenceStatus = rankedGroups.length > 1 ? 'conflict' : 'resolved'
  const confidence =
    status === 'conflict'
      ? clamp(canonicalGroup.score / Math.max(totalScore, 1), 0, 1)
      : clamp(canonicalCandidate.confidence, 0, 1)

  return {
    fieldKey,
    canonicalValue: displayValue(canonicalCandidate.value),
    canonicalSource: canonicalCandidate.source,
    canonicalSourceRecordId: canonicalCandidate.sourceRecordId,
    canonicalSourceDatasetId: canonicalCandidate.sourceDatasetId,
    confidence: round4(confidence),
    status,
    evidenceCount: evidence.length,
    conflictingValues: rankedGroups.slice(1).map((group) => ({
      normalizedValue: group.normalizedValue,
      values: unique(group.candidates.map((candidate) => displayValue(candidate.value))),
      sources: unique(group.candidates.map((candidate) => candidate.source).filter(Boolean)),
      score: round4(group.score),
    })),
    evidence,
  }
}

function groupCandidates(fieldKey: FieldKey, candidates: FieldEvidenceCandidate[]) {
  const groups = new Map<
    string,
    { normalizedValue: string; score: number; candidates: FieldEvidenceCandidate[] }
  >()

  for (const candidate of candidates) {
    const normalizedValue = normalizeValue(fieldKey, candidate.value)
    if (normalizedValue === null) continue

    const group = groups.get(normalizedValue) ?? {
      normalizedValue,
      score: 0,
      candidates: [],
    }
    group.score += candidateScore(candidate)
    group.candidates.push(candidate)
    groups.set(normalizedValue, group)
  }

  return groups
}

function valueFromCanonicalIdentity(fieldKey: FieldKey, dossier: Dossier) {
  const identity = dossier.canonicalIdentity

  switch (fieldKey) {
    case 'cnj_number':
      return identity.cnjNumber
    case 'origin_process_number':
      return identity.originProcessNumber
    case 'asset_number':
      return identity.assetNumber
    case 'debtor_name':
      return identity.debtor?.name ?? null
    case 'debtor_state_code':
      return identity.debtor?.stateCode ?? null
    case 'court_alias':
      return identity.court?.alias ?? null
    case 'court_code':
      return identity.court?.code ?? null
    case 'budget_unit_code':
      return identity.budgetUnit?.code ?? null
    case 'nature':
      return identity.nature
    case 'lifecycle_status':
      return identity.lifecycleStatus
    case 'exercise_year':
      return identity.exerciseYear
    case 'budget_year':
      return identity.budgetYear
    case 'face_value':
    case 'estimated_updated_value':
    case 'queue_position':
      return null
  }
}

function valueFromPayload(fieldKey: FieldKey, payload: JsonRecord) {
  const aliases: Record<FieldKey, string[]> = {
    cnj_number: ['cnjNumber', 'cnj_number', 'numeroProcesso', 'processNumber'],
    origin_process_number: ['originProcessNumber', 'origin_process_number', 'processoOrigem'],
    asset_number: ['assetNumber', 'asset_number', 'precatorioNumber', 'numeroPrecatorio'],
    debtor_name: ['debtorName', 'debtor_name', 'devedor', 'entidadeDevedora'],
    debtor_state_code: ['stateCode', 'state_code', 'uf'],
    court_alias: ['courtAlias', 'court_alias', 'tribunalAlias'],
    court_code: ['courtCode', 'court_code', 'tribunalCode'],
    budget_unit_code: ['budgetUnitCode', 'budget_unit_code', 'unidadeOrcamentaria'],
    nature: ['nature', 'natureza'],
    lifecycle_status: ['lifecycleStatus', 'lifecycle_status', 'status'],
    exercise_year: ['exerciseYear', 'exercise_year', 'exercicio'],
    budget_year: ['budgetYear', 'budget_year', 'anoOrcamento'],
    face_value: ['faceValue', 'face_value', 'valorFace', 'valorPrincipal'],
    estimated_updated_value: [
      'estimatedUpdatedValue',
      'estimated_updated_value',
      'valorAtualizado',
      'updatedValue',
    ],
    queue_position: ['queuePosition', 'queue_position', 'posicaoFila', 'ordemCronologica'],
  }

  for (const key of aliases[fieldKey]) {
    if (payload[key] !== undefined && payload[key] !== null) return payload[key]
  }

  return null
}

function sourceFromRecord(dossier: Dossier, sourceRecordId: string | null) {
  if (!sourceRecordId) return null

  return (
    dossier.evidenceGraph.sourceRecords.find((record) => record.id === sourceRecordId)?.source ??
    null
  )
}

function addCandidate(candidates: FieldEvidenceCandidate[], candidate: FieldEvidenceCandidate) {
  if (normalizeValue(candidate.fieldKey, candidate.value) === null) return

  candidates.push({
    ...candidate,
    confidence: clamp(candidate.confidence, 0, 1),
  })
}

function evidencePayload(fieldKey: FieldKey, candidate: FieldEvidenceCandidate): JsonRecord {
  return {
    value: displayValue(candidate.value),
    normalizedValue: normalizeValue(fieldKey, candidate.value),
    source: candidate.source,
    sourceRecordId: candidate.sourceRecordId,
    sourceDatasetId: candidate.sourceDatasetId,
    confidence: round4(candidate.confidence),
    weight: candidate.weight,
    reason: candidate.reason,
  }
}

function sourceLinkWeight(linkType: AssetSourceLinkType) {
  switch (linkType) {
    case 'primary':
      return 90
    case 'cross_check':
      return 82
    case 'enrichment':
      return 72
    case 'manual':
      return 65
    case 'conflict':
      return 35
  }
}

function candidateScore(candidate: FieldEvidenceCandidate) {
  return candidate.weight * candidate.confidence
}

function normalizeValue(fieldKey: FieldKey, value: unknown) {
  if (value === null || value === undefined) return null

  if (['cnj_number', 'origin_process_number', 'asset_number'].includes(fieldKey)) {
    const normalized = String(value).replace(/\D/g, '')
    return normalized.length > 0 ? normalized : null
  }

  if (['face_value', 'estimated_updated_value'].includes(fieldKey)) {
    const number = Number(String(value).replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(number) && number > 0 ? number.toFixed(2) : null
  }

  if (['exercise_year', 'budget_year', 'queue_position'].includes(fieldKey)) {
    const number = Number(value)
    return Number.isFinite(number) ? String(Math.trunc(number)) : null
  }

  const normalized = String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')

  return normalized.length > 0 ? normalized : null
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) return null

  return String(value).trim()
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000
}

function unique<T>(values: T[]) {
  return [...new Set(values)]
}

export const assetFieldEvidenceService = new AssetFieldEvidenceService()
export default assetFieldEvidenceService
