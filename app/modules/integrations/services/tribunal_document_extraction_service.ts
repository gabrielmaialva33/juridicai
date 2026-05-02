import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import ExcelJS from 'exceljs'
import SourceRecord from '#modules/siop/models/source_record'
import { normalizeCnj } from '#modules/siop/parsers/cnj_parser'
import { parseBrazilianMoney } from '#modules/siop/parsers/value_parser'
import type { JsonRecord } from '#shared/types/model_enums'

const execFileAsync = promisify(execFile)

export type TribunalDocumentFormat = 'csv' | 'xlsx' | 'html' | 'pdf' | 'unsupported'

export type TribunalExtractedRow = {
  rowNumber: number
  rawData: JsonRecord
  normalizedCnj: string | null
  normalizedValue: string | null
  normalizedYear: number | null
  rowFingerprint: string
}

export type TribunalDocumentExtractionResult = {
  sourceRecord: SourceRecord
  format: TribunalDocumentFormat
  status: 'extracted' | 'unsupported' | 'empty'
  rows: TribunalExtractedRow[]
  text: string | null
  errors: string[]
}

export type TribunalDocumentExtractionOptions = {
  pdfTextExtractor?: (filePath: string) => Promise<string>
  annotateSourceRecord?: boolean
}

class TribunalDocumentExtractionService {
  async extractSourceRecord(
    sourceRecordId: string,
    options: TribunalDocumentExtractionOptions = {}
  ): Promise<TribunalDocumentExtractionResult> {
    const sourceRecord = await SourceRecord.findOrFail(sourceRecordId)
    const result = await this.extract(sourceRecord, options)

    if (options.annotateSourceRecord) {
      sourceRecord.merge({
        rawData: {
          ...(sourceRecord.rawData ?? {}),
          extraction: {
            format: result.format,
            status: result.status,
            rows: result.rows.length,
            errors: result.errors,
          },
        },
      })
      await sourceRecord.save()
    }

    return result
  }

  async extract(
    sourceRecord: SourceRecord,
    options: TribunalDocumentExtractionOptions = {}
  ): Promise<TribunalDocumentExtractionResult> {
    if (!sourceRecord.sourceFilePath) {
      return resultFor(sourceRecord, 'unsupported', 'unsupported', [], null, [
        'Source record has no stored file path.',
      ])
    }

    const format = detectDocumentFormat(sourceRecord)

    if (format === 'unsupported') {
      return resultFor(sourceRecord, format, 'unsupported', [], null, [
        'Unsupported tribunal document format.',
      ])
    }

    if (format === 'pdf') {
      return this.extractPdf(sourceRecord, options.pdfTextExtractor)
    }

    const buffer = await readFile(sourceRecord.sourceFilePath)

    if (format === 'csv') {
      const rows = rowsFromRecords(parseDelimitedText(decodeText(buffer)))
      return resultFor(sourceRecord, format, rows.length ? 'extracted' : 'empty', rows, null, [])
    }

    if (format === 'xlsx') {
      const rows = rowsFromRecords(await parseWorkbook(buffer))
      return resultFor(sourceRecord, format, rows.length ? 'extracted' : 'empty', rows, null, [])
    }

    const parsedHtml = parseHtmlTables(decodeText(buffer))
    const rows = rowsFromRecords(parsedHtml.rows)

    return resultFor(
      sourceRecord,
      format,
      rows.length || parsedHtml.text ? 'extracted' : 'empty',
      rows,
      parsedHtml.text,
      []
    )
  }

  private async extractPdf(
    sourceRecord: SourceRecord,
    pdfTextExtractor?: (filePath: string) => Promise<string>
  ) {
    try {
      const text = await (pdfTextExtractor ?? extractPdfTextWithPoppler)(
        sourceRecord.sourceFilePath!
      )
      const rows = rowsFromRecords(recordsFromLooseText(text))

      return resultFor(
        sourceRecord,
        'pdf',
        rows.length || text.trim() ? 'extracted' : 'empty',
        rows,
        text,
        []
      )
    } catch (error) {
      return resultFor(sourceRecord, 'pdf', 'unsupported', [], null, [
        error instanceof Error ? error.message : 'PDF text extraction failed.',
      ])
    }
  }
}

export function detectDocumentFormat(sourceRecord: SourceRecord): TribunalDocumentFormat {
  const mimeType = sourceRecord.mimeType?.toLowerCase() ?? ''
  const storedName = [
    sourceRecord.originalFilename,
    sourceRecord.sourceFilePath,
    sourceRecord.rawData?.format,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  const sourceUrl = sourceRecord.sourceUrl?.toLowerCase() ?? ''

  if (mimeType.includes('pdf') || /\.pdf(?:$|\?)/i.test(storedName)) {
    return 'pdf'
  }

  if (
    mimeType.includes('spreadsheetml') ||
    mimeType.includes('excel') ||
    /\.xlsx(?:$|\?)/i.test(storedName)
  ) {
    return 'xlsx'
  }

  if (mimeType.includes('csv') || /\.csv(?:$|\?)/i.test(storedName)) {
    return 'csv'
  }

  if (mimeType.includes('html') || /\.html?(?:$|\?)/i.test(storedName)) {
    return 'html'
  }

  if (/\.pdf(?:$|\?)/i.test(sourceUrl)) {
    return 'pdf'
  }

  if (/\.xlsx(?:$|\?)/i.test(sourceUrl)) {
    return 'xlsx'
  }

  if (/\.csv(?:$|\?)/i.test(sourceUrl)) {
    return 'csv'
  }

  if (/\.html?(?:$|\?)/i.test(sourceUrl)) {
    return 'html'
  }

  return 'unsupported'
}

export function parseDelimitedText(text: string): JsonRecord[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return []
  }

  const delimiter = detectDelimiter(lines[0])
  const headers = splitDelimitedLine(lines[0], delimiter).map(normalizeHeader)

  return lines.slice(1).map((line) => {
    const values = splitDelimitedLine(line, delimiter)
    return headers.reduce<JsonRecord>((row, header, index) => {
      row[header || `column_${index + 1}`] = values[index] ?? null
      return row
    }, {})
  })
}

export function parseHtmlTables(html: string) {
  const rows: JsonRecord[] = []
  const tablePattern = /<table[\s\S]*?<\/table>/gi
  let tableMatch: RegExpExecArray | null

  while ((tableMatch = tablePattern.exec(html))) {
    rows.push(...parseHtmlTable(tableMatch[0]))
  }

  return {
    rows,
    text: compactText(stripTags(html)).slice(0, 20000) || null,
  }
}

async function parseWorkbook(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0])
  const worksheet = workbook.worksheets[0]

  if (!worksheet) {
    return []
  }

  const headers = worksheetRowValues(worksheet.getRow(1)).map((header) =>
    normalizeHeader(String(header ?? ''))
  )
  const rows: JsonRecord[] = []

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const values = worksheetRowValues(worksheet.getRow(rowNumber))
    const row = headers.reduce<JsonRecord>((payload, header, index) => {
      payload[header || `column_${index + 1}`] = values[index] ?? null
      return payload
    }, {})

    if (Object.values(row).some((value) => value !== null && value !== '')) {
      rows.push(row)
    }
  }

  return rows
}

function parseHtmlTable(tableHtml: string) {
  const rawRows = [...tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((match) => match[0])
  const matrix = rawRows
    .map((rowHtml) =>
      [...rowHtml.matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map((cell) =>
        compactText(stripTags(cell[1]))
      )
    )
    .filter((row) => row.length > 0)

  if (matrix.length < 2) {
    return []
  }

  const headers = matrix[0].map(normalizeHeader)

  return matrix.slice(1).map((cells) =>
    headers.reduce<JsonRecord>((payload, header, index) => {
      payload[header || `column_${index + 1}`] = cells[index] ?? null
      return payload
    }, {})
  )
}

function recordsFromLooseText(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => compactText(line))
    .filter((line) => line && (findCnj(line) || findMoney(line)))
    .map<JsonRecord>((line) => ({ line }))
}

function rowsFromRecords(records: JsonRecord[]) {
  return records.map<TribunalExtractedRow>((record, index) => {
    const normalizedCnj = findCnj(record)
    const normalizedValue = findMoney(record)
    const normalizedYear = findYear(record)
    const rawData = normalizeRecord(record)

    return {
      rowNumber: index + 1,
      rawData,
      normalizedCnj,
      normalizedValue,
      normalizedYear,
      rowFingerprint: stableHash({ rawData, normalizedCnj, normalizedValue, normalizedYear }),
    }
  })
}

async function extractPdfTextWithPoppler(filePath: string) {
  const { stdout } = await execFileAsync('pdftotext', ['-layout', filePath, '-'], {
    maxBuffer: 20 * 1024 * 1024,
  })

  return stdout
}

function worksheetRowValues(row: ExcelJS.Row) {
  const values: Array<string | number | boolean | null> = []

  for (let index = 1; index <= row.cellCount; index += 1) {
    values.push(normalizeCellValue(row.getCell(index).value))
  }

  return values
}

function normalizeCellValue(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value !== 'object') {
    return value
  }

  if ('text' in value) {
    return value.text
  }

  if ('result' in value) {
    return typeof value.result === 'object' ? String(value.result ?? '') : (value.result ?? null)
  }

  if ('richText' in value) {
    return value.richText.map((entry) => entry.text).join('')
  }

  return String(value)
}

function findCnj(value: unknown) {
  const text = flattenValue(value)
  const candidates = text.match(/\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/g) ?? []

  for (const candidate of candidates) {
    const normalized = normalizeCnj(candidate)
    if (normalized) {
      return normalized
    }
  }

  return null
}

function findMoney(value: unknown) {
  const text = flattenValue(value)
  const candidates =
    text.match(/(?:R\$\s*)?-?\d{1,3}(?:\.\d{3})*,\d{2}|(?:R\$\s*)?-?\d+,\d{2}/g) ?? []

  for (const candidate of candidates) {
    const parsed = parseBrazilianMoney(candidate)
    if (parsed) {
      return parsed
    }
  }

  return null
}

function findYear(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, entry] of Object.entries(value)) {
      if (!/(?:ano|exercicio|proposta|orcamento|budget|year)/i.test(key)) {
        continue
      }

      const year = firstYear(flattenValue(entry))
      if (year) {
        return year
      }
    }
  }

  const text = flattenValue(value)
  const labeledYear = text.match(/(?:ano|exerc[ií]cio|proposta|or[cç]amento)\D{0,30}(20\d{2})/i)
  if (labeledYear) {
    return Number(labeledYear[1])
  }

  return firstYear(text)
}

function firstYear(text: string) {
  const candidates = text.match(/\b20\d{2}\b/g) ?? []

  for (const candidate of candidates) {
    const year = Number(candidate)
    if (year >= 2000 && year <= 2100) {
      return year
    }
  }

  return null
}

function normalizeRecord(record: JsonRecord) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [normalizeHeader(key), normalizeScalar(value)])
  ) as JsonRecord
}

function normalizeScalar(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'string') {
    return compactText(value)
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  return compactText(String(value))
}

function flattenValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.map(flattenValue).join(' ')
  }

  if (value && typeof value === 'object') {
    return Object.values(value).map(flattenValue).join(' ')
  }

  return ''
}

function resultFor(
  sourceRecord: SourceRecord,
  format: TribunalDocumentFormat,
  status: TribunalDocumentExtractionResult['status'],
  rows: TribunalExtractedRow[],
  text: string | null,
  errors: string[]
): TribunalDocumentExtractionResult {
  return {
    sourceRecord,
    format,
    status,
    rows,
    text,
    errors,
  }
}

function decodeText(buffer: Buffer) {
  const utf8 = buffer.toString('utf8')

  if (!utf8.includes('\uFFFD')) {
    return utf8
  }

  return new TextDecoder('windows-1252').decode(buffer)
}

function detectDelimiter(line: string) {
  const semicolons = (line.match(/;/g) ?? []).length
  const commas = (line.match(/,/g) ?? []).length
  return semicolons >= commas ? ';' : ','
}

function splitDelimitedLine(line: string, delimiter: string) {
  const values: string[] = []
  let current = ''
  let quoted = false

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted
      continue
    }

    if (char === delimiter && !quoted) {
      values.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  values.push(current.trim())
  return values
}

function normalizeHeader(header: string) {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function stripTags(input: string) {
  return input.replace(/<[^>]*>/g, '')
}

function compactText(input: string) {
  return decodeHtml(input).replace(/\s+/g, ' ').trim()
}

function decodeHtml(input: string) {
  return input
    .replace(/&#(\d+);/g, (_, codePoint: string) => String.fromCodePoint(Number(codePoint)))
    .replace(/&#x([a-f0-9]+);/gi, (_, codePoint: string) =>
      String.fromCodePoint(Number.parseInt(codePoint, 16))
    )
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
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

export default new TribunalDocumentExtractionService()
