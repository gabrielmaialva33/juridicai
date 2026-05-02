import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import SourceRecord from '#modules/siop/models/source_record'
import sourceEvidenceService from '#modules/integrations/services/source_evidence_service'
import type { JsonRecord } from '#shared/types/model_enums'

const TJBA_API_BASE_URL = 'https://listaprecatoriosws.tjba.jus.br/'
const TJBA_DEBTORS_PATH = 'api/entidade-devedora/'
const TJBA_PRECATORIOS_PATH = 'api/entidade-devedora/precatorios'

export type TjbaPrecatorioApiAdapterOptions = {
  tenantId: string
  fetcher?: typeof fetch
  pageSize?: number | null
  maxPages?: number | null
}

export type TjbaDebtorApiRow = {
  cdEntidade: number
  deEntidade: string
  tipoRegime: string | null
  listaPrecatorio: null
}

export type TjbaPrecatorioApiRow = {
  cdPrecatorio: string | null
  cdEntidadeDevedora: number | null
  deEntidadeDevedora: string | null
  nuAnoOrcamento: number | null
  cdNatureza: string | null
  dtExpedicao: number[] | null
  deUnidadeRequisitante: string | null
  deBeneficiario: string | null
  valorDevido: number | null
  dataExp: string | null
  hora: string | null
  siglaTipo: string | null
  siglaCdNatureza: string | null
  ordemCronologica: number | null
  flprioridade: number | null
  flnormal: number | null
  flagPrioridade: boolean | null
  valor: string | null
  [key: string]: unknown
}

export type TjbaPrecatorioApiPagePayload = {
  content: Array<{
    cdEntidade: number | null
    deEntidade: string | null
    tipoRegime: string | null
    listaPrecatorio: TjbaPrecatorioApiRow[] | null
  }>
  totalElements: number
  totalPages: number
  number: number
  size: number
  numberOfElements: number
  empty: boolean
}

export type TjbaPrecatorioApiAdapterResult = {
  debtorsDiscovered: number
  pagesDiscovered: number
  pagesFetched: number
  sourceRecordsCreated: number
  totalElements: number
  sourceRecords: SourceRecord[]
}

class TjbaPrecatorioApiAdapter {
  async sync(options: TjbaPrecatorioApiAdapterOptions): Promise<TjbaPrecatorioApiAdapterResult> {
    const fetcher = options.fetcher ?? fetch
    const pageSize = normalizePositiveInteger(options.pageSize, 200)
    const debtors = await this.fetchJson<TjbaDebtorApiRow[]>(fetcher, urlFor(TJBA_DEBTORS_PATH))
    const debtorNamesByCode = debtorLookup(debtors)
    const firstPage = await this.fetchPage(fetcher, 1, pageSize)
    const pageCount = Math.min(
      firstPage.payload.totalPages || 1,
      normalizePositiveInteger(options.maxPages, 1)
    )
    const sourceRecords: SourceRecord[] = []
    let created = 0
    const firstPersisted = await this.persistSourceRecord({
      tenantId: options.tenantId,
      url: firstPage.url,
      payload: firstPage.payload,
      page: 1,
      pageSize,
      debtorNamesByCode,
    })

    sourceRecords.push(firstPersisted.sourceRecord)
    created += firstPersisted.created ? 1 : 0

    for (let page = 2; page <= pageCount; page += 1) {
      const currentPage = await this.fetchPage(fetcher, page, pageSize)
      const persisted = await this.persistSourceRecord({
        tenantId: options.tenantId,
        url: currentPage.url,
        payload: currentPage.payload,
        page,
        pageSize,
        debtorNamesByCode,
      })

      sourceRecords.push(persisted.sourceRecord)
      created += persisted.created ? 1 : 0
    }

    return {
      debtorsDiscovered: debtors.length,
      pagesDiscovered: firstPage.payload.totalPages || pageCount,
      pagesFetched: sourceRecords.length,
      sourceRecordsCreated: created,
      totalElements: firstPage.payload.totalElements ?? 0,
      sourceRecords,
    }
  }

  private async fetchPage(fetcher: typeof fetch, page: number, pageSize: number) {
    const url = urlFor(TJBA_PRECATORIOS_PATH, {
      cdunidade: 0,
      numPrecatorio: '',
      cRequerida: 0,
      natureza: 'TODOS',
      mostrarTodos: false,
      page,
      size: pageSize,
      grupoDados: 'TODOS',
    })

    return {
      url,
      payload: await this.fetchJson<TjbaPrecatorioApiPagePayload>(fetcher, url),
    }
  }

  private async fetchJson<T>(fetcher: typeof fetch, url: string): Promise<T> {
    const response = await fetcher(url, {
      headers: {
        accept: 'application/json, text/plain, */*',
      },
    })

    if (!response.ok) {
      throw new Error(`TJBA precatorio API request failed for ${url} with HTTP ${response.status}.`)
    }

    return (await response.json()) as T
  }

  private async persistSourceRecord(input: {
    tenantId: string
    url: string
    payload: TjbaPrecatorioApiPagePayload
    page: number
    pageSize: number
    debtorNamesByCode: Record<string, string>
  }) {
    const body = Buffer.from(stableStringify(input.payload))
    const contentChecksum = createHash('sha256').update(body).digest('hex')
    const checksum = createHash('sha256').update(input.url).update(contentChecksum).digest('hex')
    const sourceDatasetId = await sourceEvidenceService.datasetIdByKey('court-annual-map-pages')
    const directory = app.makePath('storage', 'tribunal', 'tjba', input.tenantId)
    const filename = `tjba-precatorios-page-${input.page}-${checksum.slice(0, 12)}.json`
    const filePath = app.makePath('storage', 'tribunal', 'tjba', input.tenantId, filename)
    const rawData = {
      providerId: 'tjba-precatorio-api',
      courtAlias: 'tjba',
      stateCode: 'BA',
      sourceKind: 'api_page',
      format: 'json',
      page: input.page,
      pageSize: input.pageSize,
      totalElements: input.payload.totalElements ?? null,
      totalPages: input.payload.totalPages ?? null,
      contentChecksum,
      debtorNamesByCode: input.debtorNamesByCode,
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
  const url = new URL(path, TJBA_API_BASE_URL)

  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, String(value))
  }

  return url.toString()
}

function debtorLookup(rows: TjbaDebtorApiRow[]) {
  const lookup: Record<string, string> = {}

  for (const row of rows) {
    if (row.cdEntidade && row.deEntidade) {
      lookup[String(row.cdEntidade)] = row.deEntidade
    }
  }

  return lookup
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

export default new TjbaPrecatorioApiAdapter()
