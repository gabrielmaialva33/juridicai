import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import tribunalDocumentExtractionService from '#modules/integrations/services/tribunal_document_extraction_service'
import sourceEvidenceService from '#modules/integrations/services/source_evidence_service'
import referenceCatalogService from '#modules/reference/services/reference_catalog_service'
import Debtor from '#modules/debtors/models/debtor'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetValuation from '#modules/precatorios/models/asset_valuation'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import SourceRecord from '#modules/siop/models/source_record'
import { normalizeCnj } from '#modules/siop/parsers/cnj_parser'
import { parseBrazilianMoney } from '#modules/siop/parsers/value_parser'
import type { AssetNature, DebtorType, JsonRecord, PaymentRegime } from '#shared/types/model_enums'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export type Trf5PrecatorioImportOptions = {
  maxRows?: number | null
  chunkSize?: number | null
  pdfTextExtractor?: (filePath: string) => Promise<string>
}

export type Trf5PrecatorioImportStats = {
  totalRows: number
  validRows: number
  selectedRows: number
  inserted: number
  updated: number
  skipped: number
  errors: number
}

type Trf5ParsedRow = {
  order: number | null
  processNumber: string
  cnjNumber: string | null
  prcNumber: string | null
  originProcessNumber: string | null
  requestNumber: string | null
  presentationDate: string | null
  value: string | null
  superPreference: string | null
  debtorName: string | null
  nature: AssetNature
  subjectText: string | null
  rawText: string
}

type ImportContext = {
  courtId: string | null
  judicialClassId: string | null
}

class Trf5PrecatorioImportService {
  async importSourceRecord(sourceRecordId: string, options: Trf5PrecatorioImportOptions = {}) {
    const sourceRecord = await SourceRecord.findOrFail(sourceRecordId)
    const extraction = await tribunalDocumentExtractionService.extractSourceRecord(
      sourceRecord.id,
      {
        pdfTextExtractor: options.pdfTextExtractor,
        annotateSourceRecord: true,
      }
    )
    const rows = parseTrf5ReportText(extraction.text ?? '', sourceRecord)
    const validRows = rows.filter((row) => row.cnjNumber || row.originProcessNumber || row.value)
    const selectedRows = limitRows(validRows, options.maxRows)
    const chunkSize = normalizeChunkSize(options.chunkSize)
    const batches = chunkRows(selectedRows, chunkSize)
    const context = await this.buildContext()
    const stats: Trf5PrecatorioImportStats = {
      totalRows: rows.length,
      validRows: validRows.length,
      selectedRows: selectedRows.length,
      inserted: 0,
      updated: 0,
      skipped: rows.length - validRows.length,
      errors: 0,
    }

    for (const batch of batches) {
      for (const row of batch) {
        try {
          await db.transaction(async (trx) => {
            const result = await this.upsertRow(sourceRecord, row, context, trx)
            stats[result] += 1
          })
        } catch {
          stats.errors += 1
        }
      }
    }

    return {
      sourceRecord,
      extraction,
      stats,
      chunking: {
        availableRows: validRows.length,
        selectedRows: selectedRows.length,
        chunkSize,
        processedBatches: batches.length,
      },
    }
  }

  private async buildContext(): Promise<ImportContext> {
    const court = await referenceCatalogService.court({
      code: 'TRF5',
      alias: 'trf5',
      name: 'Tribunal Regional Federal da 5ª Região',
    })
    const judicialClass = await referenceCatalogService.judicialClass({
      code: 1265,
      name: 'Precatório',
    })

    return {
      courtId: court?.id ?? null,
      judicialClassId: judicialClass?.id ?? null,
    }
  }

  private async upsertRow(
    sourceRecord: SourceRecord,
    row: Trf5ParsedRow,
    context: ImportContext,
    trx: TransactionClientContract
  ) {
    const debtor = await this.findOrCreateDebtor(sourceRecord, row, trx)
    const externalId = buildExternalId(sourceRecord, row)
    const existing = await PrecatorioAsset.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where((builder) => {
        if (row.cnjNumber) {
          builder.where('cnj_number', row.cnjNumber).orWhere('external_id', externalId)
          return
        }

        builder.where('external_id', externalId)
      })
      .first()
    const rawData = buildAssetRawData(sourceRecord, row)
    const payload = {
      tenantId: sourceRecord.tenantId,
      sourceRecordId: sourceRecord.id,
      source: 'tribunal' as const,
      externalId,
      cnjNumber: row.cnjNumber,
      originProcessNumber: row.originProcessNumber,
      debtorId: debtor.id,
      courtId: context.courtId,
      assetNumber: row.processNumber,
      exerciseYear: numberFrom(sourceRecord.rawData?.year),
      budgetYear: numberFrom(sourceRecord.rawData?.year),
      nature: row.nature,
      lifecycleStatus:
        sourceRecord.rawData?.sourceKind === 'paid_precatorios'
          ? ('paid' as const)
          : ('discovered' as const),
      piiStatus: 'pseudonymous' as const,
      complianceStatus: 'approved_for_analysis' as const,
      rawData,
      rowFingerprint: stableHash(rawData),
    }

    if (existing) {
      existing.useTransaction(trx)
      existing.merge(payload)
      await existing.save()
      await this.upsertRelatedRecords(sourceRecord, existing, row, context, trx)
      return 'updated' as const
    }

    const asset = await PrecatorioAsset.create(payload, { client: trx })
    await this.upsertRelatedRecords(sourceRecord, asset, row, context, trx)
    return 'inserted' as const
  }

  private async upsertRelatedRecords(
    sourceRecord: SourceRecord,
    asset: PrecatorioAsset,
    row: Trf5ParsedRow,
    context: ImportContext,
    trx: TransactionClientContract
  ) {
    await this.createValuation(sourceRecord, asset.id, row, trx)
    await this.upsertJudicialProcess(sourceRecord, asset, row, context, trx)
    await this.createEvent(sourceRecord, asset.id, row, trx)
    await this.recordSourceEvidence(sourceRecord, asset, row, trx)
  }

  private async findOrCreateDebtor(
    sourceRecord: SourceRecord,
    row: Trf5ParsedRow,
    trx: TransactionClientContract
  ) {
    const profile = debtorProfileFor(row.debtorName ?? stringFrom(sourceRecord.rawData?.debtorName))
    const existing = await Debtor.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('normalized_key', profile.normalizedKey)
      .where('state_code', profile.stateCode)
      .first()

    if (existing) {
      return existing
    }

    return Debtor.create(
      {
        tenantId: sourceRecord.tenantId,
        name: profile.name,
        normalizedName: profile.normalizedKey,
        normalizedKey: profile.normalizedKey,
        debtorType: profile.debtorType,
        cnpj: null,
        stateCode: profile.stateCode,
        paymentRegime: profile.paymentRegime,
      },
      { client: trx }
    )
  }

  private createValuation(
    sourceRecord: SourceRecord,
    assetId: string,
    row: Trf5ParsedRow,
    trx: TransactionClientContract
  ) {
    return AssetValuation.create(
      {
        tenantId: sourceRecord.tenantId,
        assetId,
        faceValue: row.value,
        estimatedUpdatedValue: row.value,
        baseDate: parseBrazilianDate(row.presentationDate),
        queuePosition: row.order,
        sourceRecordId: sourceRecord.id,
        rawData: buildAssetRawData(sourceRecord, row),
      },
      { client: trx }
    )
  }

  private async upsertJudicialProcess(
    sourceRecord: SourceRecord,
    asset: PrecatorioAsset,
    row: Trf5ParsedRow,
    context: ImportContext,
    trx: TransactionClientContract
  ) {
    const processNumber = row.cnjNumber ?? row.originProcessNumber
    if (!processNumber) {
      return null
    }

    const payload = {
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      source: 'tribunal' as const,
      cnjNumber: processNumber,
      courtId: context.courtId,
      classId: context.judicialClassId,
      courtAlias: 'trf5',
      filedAt: parseBrazilianDate(row.presentationDate),
      rawData: {
        providerId: 'trf5-precatorio-reports',
        courtAlias: 'trf5',
        sourceRecordId: sourceRecord.id,
        prcNumber: row.prcNumber,
        requestNumber: row.requestNumber,
      },
    }
    const existing = await JudicialProcess.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('cnj_number', processNumber)
      .first()

    if (existing) {
      existing.useTransaction(trx)
      existing.merge(payload)
      await existing.save()
      return existing
    }

    return JudicialProcess.create(payload, { client: trx })
  }

  private async createEvent(
    sourceRecord: SourceRecord,
    assetId: string,
    row: Trf5ParsedRow,
    trx: TransactionClientContract
  ) {
    const idempotencyKey = `trf5:${sourceRecord.id}:${row.processNumber}:${row.requestNumber ?? row.order ?? 'row'}`
    const existing = await AssetEvent.query({ client: trx })
      .where('tenant_id', sourceRecord.tenantId)
      .where('asset_id', assetId)
      .where('event_type', 'trf5_imported')
      .where('idempotency_key', idempotencyKey)
      .first()

    if (existing) {
      return existing
    }

    return AssetEvent.create(
      {
        tenantId: sourceRecord.tenantId,
        assetId,
        eventType: 'trf5_imported',
        eventDate: DateTime.now(),
        source: 'tribunal',
        payload: buildEventRawData(row),
        idempotencyKey,
      },
      { client: trx }
    )
  }

  private async recordSourceEvidence(
    sourceRecord: SourceRecord,
    asset: PrecatorioAsset,
    row: Trf5ParsedRow,
    trx: TransactionClientContract
  ) {
    await sourceEvidenceService.linkAsset({
      tenantId: sourceRecord.tenantId,
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: 'trf5-precatorio-reports',
      linkType: 'primary',
      confidence: row.cnjNumber ? 1 : 0.85,
      matchReason: row.cnjNumber ? 'trf5_cnj_match' : 'trf5_request_match',
      matchedFields: {
        cnjNumber: row.cnjNumber,
        processNumber: row.processNumber,
        requestNumber: row.requestNumber,
        prcNumber: row.prcNumber,
      },
      normalizedPayload: {
        cnjNumber: row.cnjNumber,
        processNumber: row.processNumber,
        originProcessNumber: row.originProcessNumber,
        requestNumber: row.requestNumber,
        value: row.value,
        superPreference: row.superPreference,
      },
      rawPointer: {
        sourceRecordId: sourceRecord.id,
        order: row.order,
      },
      trx,
    })

    await this.upsertIdentifier(
      sourceRecord,
      asset.id,
      'precatorio_number',
      row.processNumber,
      true,
      row,
      trx
    )
    await this.upsertIdentifier(
      sourceRecord,
      asset.id,
      'requisition_number',
      row.requestNumber,
      false,
      row,
      trx
    )
    await this.upsertIdentifier(
      sourceRecord,
      asset.id,
      'payment_queue_id',
      row.prcNumber,
      false,
      row,
      trx
    )
    await this.upsertIdentifier(sourceRecord, asset.id, 'cnj_number', row.cnjNumber, true, row, trx)
  }

  private async upsertIdentifier(
    sourceRecord: SourceRecord,
    assetId: string,
    identifierType: 'precatorio_number' | 'requisition_number' | 'payment_queue_id' | 'cnj_number',
    identifierValue: string | null,
    isPrimary: boolean,
    row: Trf5ParsedRow,
    trx: TransactionClientContract
  ) {
    if (!identifierValue) {
      return
    }

    await sourceEvidenceService.upsertIdentifier({
      tenantId: sourceRecord.tenantId,
      assetId,
      sourceRecordId: sourceRecord.id,
      sourceDatasetKey: 'trf5-precatorio-reports',
      identifierType,
      identifierValue,
      issuer: 'TRF5',
      isPrimary,
      rawData: buildAssetRawData(sourceRecord, row),
      trx,
    })
  }
}

export function parseTrf5ReportText(text: string, sourceRecord: SourceRecord): Trf5ParsedRow[] {
  const lines = text.split(/\r?\n/)
  const rows: Trf5ParsedRow[] = []
  const headerDebtor = extractHeaderDebtor(text, sourceRecord)
  let current: string[] = []

  for (const line of lines) {
    if (isDataRow(line)) {
      if (current.length) {
        rows.push(buildRow(current, headerDebtor))
      }
      current = [line]
      continue
    }

    if (current.length) {
      current.push(line)
    }
  }

  if (current.length) {
    rows.push(buildRow(current, headerDebtor))
  }

  return rows.filter((row) => row.processNumber)
}

function buildRow(block: string[], headerDebtor: string | null): Trf5ParsedRow {
  const firstLine = compactText(block[0])
  const orderMatch = firstLine.match(/^\s*(\d+)\s+/)
  const processNumber = firstLine.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}(?:\.\d{4})?/)?.[0] ?? ''
  const rawText = compactText(block.join(' '))

  return {
    order: orderMatch ? Number(orderMatch[1]) : null,
    processNumber,
    cnjNumber: normalizeTrf5ProcessNumber(processNumber),
    prcNumber: firstLine.match(/PRC\d+-[A-Z]{2}/i)?.[0] ?? null,
    originProcessNumber: extractOriginProcessNumber(firstLine),
    requestNumber: firstLine.match(/\b\d{17,25}\b/g)?.at(-1) ?? null,
    presentationDate: extractPresentationDate(rawText),
    value: parseBrazilianMoney(
      firstLine.match(/(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}/)?.[0] ?? null
    ),
    superPreference: extractSuperPreference(firstLine),
    debtorName: extractRowDebtor(rawText) ?? headerDebtor,
    nature: detectNature(firstLine),
    subjectText: extractSubject(rawText),
    rawText,
  }
}

function isDataRow(line: string) {
  return /^\s*\d+\s+\d{7}-\d{2}\.\d{4}\.\d\.\d{2}(?:\.\d{4})?\b/.test(line)
}

function normalizeTrf5ProcessNumber(value: string | null) {
  if (!value) {
    return null
  }

  return normalizeCnj(value) ?? normalizeCnj(`${value}.0000`)
}

function extractOriginProcessNumber(text: string) {
  const formatted = text.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g)?.[1]
  if (formatted) {
    return normalizeCnj(formatted) ?? formatted
  }

  const digits = text.match(/\b\d{20}\b/)?.[0]
  if (!digits) {
    return null
  }

  return normalizeCnj(digits) ?? digits
}

function extractHeaderDebtor(text: string, sourceRecord: SourceRecord) {
  return (
    text.match(/Entidade Devedora:\s*(.+)/i)?.[1]?.trim() ??
    stringFrom(sourceRecord.rawData?.debtorName)
  )
}

function extractRowDebtor(text: string) {
  return text.match(/Réu\s+(.+?)(?:Assunto Unificado|$)/i)?.[1]?.trim() ?? null
}

function extractPresentationDate(text: string) {
  return (
    text.match(/Data de Apresentação\s+(\d{2}\/\d{2}\/\d{4})/i)?.[1] ??
    text.match(/\b\d{2}\/\d{2}\/\d{4}\b/)?.[0] ??
    null
  )
}

function extractSuperPreference(text: string) {
  const match = text.match(/(Doença Grave|Doenca Grave|Idoso|Não|Nao)\s*$/i)
  return match?.[1] ?? null
}

function extractSubject(text: string) {
  return text.match(/Assunto Unificado \(TUA\):\s*(.+)$/i)?.[1]?.trim() ?? null
}

function detectNature(text: string): AssetNature {
  const normalized = text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
  return normalized.includes('alimentar') && !normalized.includes('nao alimentar')
    ? 'alimentar'
    : 'comum'
}

function debtorProfileFor(input: string | null): {
  name: string
  normalizedKey: string
  debtorType: DebtorType
  paymentRegime: PaymentRegime
  stateCode: string
} {
  const name = compactText(input ?? 'Entidade devedora não identificada - TRF5')
  const normalizedKey = normalizeKey(name)
  const normalized = normalizedKey
  const stateCode = inferStateCode(name)

  if (looksLikeStateMunicipalDebtor(name)) {
    return {
      name,
      normalizedKey,
      debtorType: 'municipality',
      paymentRegime: 'other',
      stateCode: stateCode ?? 'BR',
    }
  }

  if (looksLikeStateDebtor(name)) {
    return {
      name,
      normalizedKey,
      debtorType: 'state',
      paymentRegime: 'other',
      stateCode: stateCode ?? 'BR',
    }
  }

  if (normalized.includes('UNIAO')) {
    return {
      name,
      normalizedKey,
      debtorType: 'union',
      paymentRegime: 'federal_unique',
      stateCode: 'BR',
    }
  }

  if (normalized.includes('MUNICIPIO')) {
    return {
      name,
      normalizedKey,
      debtorType: 'municipality',
      paymentRegime: 'other',
      stateCode: stateCode ?? 'BR',
    }
  }

  if (normalized.includes('ESTADO')) {
    return {
      name,
      normalizedKey,
      debtorType: 'state',
      paymentRegime: 'other',
      stateCode: stateCode ?? 'BR',
    }
  }

  return {
    name,
    normalizedKey,
    debtorType: 'autarchy',
    paymentRegime: 'federal_unique',
    stateCode: 'BR',
  }
}

function buildExternalId(sourceRecord: SourceRecord, row: Trf5ParsedRow) {
  return `trf5:${sourceRecord.rawData?.sourceKind ?? 'report'}:${row.processNumber}:${row.requestNumber ?? row.order ?? stableHash(row.rawText).slice(0, 12)}`
}

function buildAssetRawData(sourceRecord: SourceRecord, row: Trf5ParsedRow): JsonRecord {
  return {
    providerId: 'trf5-precatorio-reports',
    sourceRecordId: sourceRecord.id,
    sourceUrl: sourceRecord.sourceUrl,
    courtAlias: 'trf5',
    sourceKind: sourceRecord.rawData?.sourceKind ?? null,
    year: sourceRecord.rawData?.year ?? null,
    processNumber: row.processNumber,
    prcNumber: row.prcNumber,
    requestNumber: row.requestNumber,
    superPreference: row.superPreference,
    subjectText: row.subjectText,
    rawText: row.rawText,
  }
}

function buildEventRawData(row: Trf5ParsedRow): JsonRecord {
  return {
    providerId: 'trf5-precatorio-reports',
    processNumber: row.processNumber,
    cnjNumber: row.cnjNumber,
    prcNumber: row.prcNumber,
    requestNumber: row.requestNumber,
    value: row.value,
    superPreference: row.superPreference,
  }
}

function limitRows(rows: Trf5ParsedRow[], maxRows?: number | null) {
  if (!maxRows || maxRows < 1) {
    return rows
  }

  return rows.slice(0, Math.trunc(maxRows))
}

function normalizeChunkSize(chunkSize?: number | null) {
  if (!chunkSize || chunkSize < 1) {
    return 250
  }

  return Math.trunc(chunkSize)
}

function chunkRows(rows: Trf5ParsedRow[], chunkSize: number) {
  const chunks: Trf5ParsedRow[][] = []

  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize))
  }

  return chunks
}

function parseBrazilianDate(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = DateTime.fromFormat(value, 'dd/LL/yyyy')
  return parsed.isValid ? parsed : null
}

function compactText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function inferStateCode(value: string) {
  const abbreviation = value
    .match(
      /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i
    )?.[1]
    ?.toUpperCase()
  if (abbreviation) {
    return abbreviation
  }

  const normalized = normalizeKey(value)
  const exact = BRAZILIAN_STATE_CODES[normalized]
  if (exact) {
    return exact
  }

  const prefix = Object.entries(BRAZILIAN_STATE_CODES).find(([stateName]) =>
    normalized.startsWith(`${stateName}_`)
  )
  if (prefix) {
    return prefix[1]
  }

  const contained = Object.entries(BRAZILIAN_STATE_CODES).find(([stateName]) =>
    normalized.includes(stateName)
  )

  return contained?.[1] ?? null
}

function looksLikeStateMunicipalDebtor(value: string) {
  return Boolean(inferStateCode(value) && /\s+-\s+/.test(value))
}

function looksLikeStateDebtor(value: string) {
  return Boolean(inferStateCode(value) && BRAZILIAN_STATE_CODES[normalizeKey(value)])
}

const BRAZILIAN_STATE_CODES: Record<string, string> = {
  ACRE: 'AC',
  ALAGOAS: 'AL',
  AMAPA: 'AP',
  AMAZONAS: 'AM',
  BAHIA: 'BA',
  CEARA: 'CE',
  DISTRITO_FEDERAL: 'DF',
  ESPIRITO_SANTO: 'ES',
  GOIAS: 'GO',
  MARANHAO: 'MA',
  MATO_GROSSO: 'MT',
  MATO_GROSSO_DO_SUL: 'MS',
  MINAS_GERAIS: 'MG',
  PARA: 'PA',
  PARAIBA: 'PB',
  PARANA: 'PR',
  PERNAMBUCO: 'PE',
  PIAUI: 'PI',
  RIO_DE_JANEIRO: 'RJ',
  RIO_GRANDE_DO_NORTE: 'RN',
  RIO_GRANDE_DO_SUL: 'RS',
  RONDONIA: 'RO',
  RORAIMA: 'RR',
  SANTA_CATARINA: 'SC',
  SAO_PAULO: 'SP',
  SERGIPE: 'SE',
  TOCANTINS: 'TO',
}

function numberFrom(value: unknown) {
  const number = Number(value)
  return Number.isInteger(number) ? number : null
}

function stringFrom(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function stableHash(value: unknown) {
  return createHash('sha256').update(stableStringify(value)).digest('hex')
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`
  }

  return JSON.stringify(value)
}

export default new Trf5PrecatorioImportService()
