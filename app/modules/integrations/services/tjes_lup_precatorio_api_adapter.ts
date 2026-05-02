import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import SourceRecord from '#modules/siop/models/source_record'
import sourceEvidenceService from '#modules/integrations/services/source_evidence_service'
import type { JsonRecord } from '#shared/types/model_enums'

const TJES_LUP_API_BASE_URL = 'https://sistemas.tjes.jus.br/lup/'
const TJES_DEBTORS_PATH = 'lup/entidades_devedoras'
const TJES_PRECATORIOS_PATH = 'lup/precatorios'

export type TjesLupPrecatorioApiAdapterOptions = {
  tenantId: string
  fetcher?: typeof fetch
  debtorLimit?: number | null
  pageSize?: number | null
  maxPagesPerDebtor?: number | null
}

export type TjesLupDebtorApiRow = {
  cd_entidade: number
  de_nome_entidade: string
  fl_regime_especial: string | null
}

export type TjesLupPrecatorioApiRow = {
  ordem: number | null
  cd_precatorio: string | null
  cd_precatorio_original: string | null
  cd_tribunal: number | null
  dt_importacao: string | null
  nu_ano_orcamento: number | null
  dt_decisao: string | null
  dt_expedicao: string | null
  cd_natureza: string | null
  nu_acao: string | null
  de_unidade_requisitante: string | null
  dt_atualizacao: string | null
  de_entidade_devedora: string | null
  vl_atualizado: number | null
  cd_entidade_devedora: number | null
  vl_fim_exercicio: number | null
  vl_prioritario_doenca: number | null
  vl_prioritario_idade: number | null
  fl_eh_ultima_importacao: string | null
  de_beneficiario: string | null
  dt_disponibilizacao: string | null
  fl_nao_baixado: string | null
  cd_exportacao: number | null
  is_prioritario_doenca: boolean | null
  is_prioritario_idade: boolean | null
  [key: string]: unknown
}

export type TjesLupPrecatorioApiPagePayload = {
  total: number
  valor_total: number | null
  results: TjesLupPrecatorioApiRow[]
}

export type TjesLupPrecatorioApiAdapterResult = {
  debtorsDiscovered: number
  debtorsFetched: number
  pagesFetched: number
  sourceRecordsCreated: number
  totalElements: number
  totalValue: number
  sourceRecords: SourceRecord[]
}

class TjesLupPrecatorioApiAdapter {
  async sync(
    options: TjesLupPrecatorioApiAdapterOptions
  ): Promise<TjesLupPrecatorioApiAdapterResult> {
    const fetcher = options.fetcher ?? fetch
    const pageSize = normalizePositiveInteger(options.pageSize, 200)
    const maxPagesPerDebtor = normalizePositiveInteger(options.maxPagesPerDebtor, 1)
    const debtors = await this.fetchJson<TjesLupDebtorApiRow[]>(fetcher, urlFor(TJES_DEBTORS_PATH))
    const selectedDebtors = limitRows(debtors, options.debtorLimit)
    const sourceRecords: SourceRecord[] = []
    let created = 0
    let totalElements = 0
    let totalValue = 0

    for (const debtor of selectedDebtors) {
      const firstPage = await this.fetchPage(fetcher, debtor.cd_entidade, 0, pageSize)
      const pageCount = Math.min(
        Math.ceil((firstPage.payload.total || 0) / pageSize) || 1,
        maxPagesPerDebtor
      )
      const persisted = await this.persistSourceRecord({
        tenantId: options.tenantId,
        url: firstPage.url,
        payload: firstPage.payload,
        debtor,
        page: 0,
        pageSize,
      })

      sourceRecords.push(persisted.sourceRecord)
      created += persisted.created ? 1 : 0
      totalElements += firstPage.payload.total ?? 0
      totalValue += firstPage.payload.valor_total ?? 0

      for (let page = 1; page < pageCount; page += 1) {
        const currentPage = await this.fetchPage(fetcher, debtor.cd_entidade, page, pageSize)
        const currentPersisted = await this.persistSourceRecord({
          tenantId: options.tenantId,
          url: currentPage.url,
          payload: currentPage.payload,
          debtor,
          page,
          pageSize,
        })

        sourceRecords.push(currentPersisted.sourceRecord)
        created += currentPersisted.created ? 1 : 0
      }
    }

    return {
      debtorsDiscovered: debtors.length,
      debtorsFetched: selectedDebtors.length,
      pagesFetched: sourceRecords.length,
      sourceRecordsCreated: created,
      totalElements,
      totalValue,
      sourceRecords,
    }
  }

  private async fetchPage(
    fetcher: typeof fetch,
    debtorCode: number,
    page: number,
    pageSize: number
  ) {
    const url = urlFor(TJES_PRECATORIOS_PATH, {
      cd_entidade_devedora: debtorCode,
      fl_eh_ultima_importacao: 'S',
      page,
      size: pageSize,
    })

    return {
      url,
      payload: await this.fetchJson<TjesLupPrecatorioApiPagePayload>(fetcher, url),
    }
  }

  private async fetchJson<T>(fetcher: typeof fetch, url: string): Promise<T> {
    const response = await fetcher(url, {
      headers: {
        'accept': 'application/json, text/plain, */*',
        'spa': 'true',
        'x-requested-with': 'XMLHttpRequest',
      },
    })

    if (!response.ok) {
      throw new Error(`TJES LUP API request failed for ${url} with HTTP ${response.status}.`)
    }

    return (await response.json()) as T
  }

  private async persistSourceRecord(input: {
    tenantId: string
    url: string
    payload: TjesLupPrecatorioApiPagePayload
    debtor: TjesLupDebtorApiRow
    page: number
    pageSize: number
  }) {
    const body = Buffer.from(stableStringify(input.payload))
    const contentChecksum = createHash('sha256').update(body).digest('hex')
    const checksum = createHash('sha256').update(input.url).update(contentChecksum).digest('hex')
    const sourceDatasetId = await sourceEvidenceService.datasetIdByKey('court-annual-map-pages')
    const directory = app.makePath('storage', 'tribunal', 'tjes', input.tenantId)
    const filename = `tjes-lup-debtor-${input.debtor.cd_entidade}-page-${input.page}-${checksum.slice(0, 12)}.json`
    const filePath = app.makePath('storage', 'tribunal', 'tjes', input.tenantId, filename)
    const rawData = {
      providerId: 'tjes-lup-api',
      courtAlias: 'tjes',
      stateCode: 'ES',
      sourceKind: 'api_page',
      format: 'json',
      page: input.page,
      pageSize: input.pageSize,
      totalElements: input.payload.total ?? null,
      totalValue: input.payload.valor_total ?? null,
      contentChecksum,
      debtor: input.debtor,
    } satisfies JsonRecord
    const existing = await SourceRecord.query()
      .where('tenant_id', input.tenantId)
      .where('source', 'tribunal')
      .where('source_checksum', checksum)
      .first()

    await mkdir(directory, { recursive: true })
    await writeFile(filePath, body)

    if (existing) {
      existing.merge({
        sourceDatasetId,
        sourceUrl: input.url,
        sourceFilePath: filePath,
        originalFilename: filename,
        mimeType: 'application/json',
        fileSizeBytes: body.byteLength,
        rawData,
      })
      await existing.save()

      return { sourceRecord: existing, created: false }
    }

    const sourceRecord = await SourceRecord.create({
      tenantId: input.tenantId,
      sourceDatasetId,
      source: 'tribunal',
      sourceUrl: input.url,
      sourceFilePath: filePath,
      sourceChecksum: checksum,
      originalFilename: filename,
      mimeType: 'application/json',
      fileSizeBytes: body.byteLength,
      collectedAt: DateTime.now(),
      rawData,
    })

    return { sourceRecord, created: true }
  }
}

function urlFor(path: string, params?: Record<string, string | number | boolean>) {
  const url = new URL(path, TJES_LUP_API_BASE_URL)

  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, String(value))
  }

  return url.toString()
}

function limitRows<T>(rows: T[], limit?: number | null) {
  if (!limit || limit < 1) {
    return rows
  }

  return rows.slice(0, Math.trunc(limit))
}

function normalizePositiveInteger(value: number | null | undefined, fallback: number) {
  if (!value || value < 1) {
    return fallback
  }

  return Math.trunc(value)
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

export default new TjesLupPrecatorioApiAdapter()
