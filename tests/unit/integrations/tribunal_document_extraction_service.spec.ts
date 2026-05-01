import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import SourceRecord from '#modules/siop/models/source_record'
import tribunalDocumentExtractionService, {
  parseDelimitedText,
  parseHtmlTables,
} from '#modules/integrations/services/tribunal_document_extraction_service'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

const VALID_CNJ = '0001234-94.2024.4.01.3400'

test.group('Tribunal document extraction service', () => {
  test('extracts normalized rows from CSV source records', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await createSourceRecord(
      tenant,
      'csv',
      ['Processo;Entidade;Valor;Ano', `${VALID_CNJ};Município de Santos;R$ 123.456,78;2024`].join(
        '\n'
      )
    )

    const result = await tribunalDocumentExtractionService.extractSourceRecord(sourceRecord.id, {
      annotateSourceRecord: true,
    })
    const updatedRecord = await SourceRecord.findOrFail(sourceRecord.id)

    assert.equal(result.format, 'csv')
    assert.equal(result.status, 'extracted')
    assert.lengthOf(result.rows, 1)
    assert.equal(result.rows[0].normalizedCnj, VALID_CNJ)
    assert.equal(result.rows[0].normalizedValue, '123456.78')
    assert.equal(result.rows[0].normalizedYear, 2024)
    assert.equal(result.rows[0].rawData.entidade, 'Município de Santos')
    assert.equal((updatedRecord.rawData?.extraction as { rows?: number } | undefined)?.rows, 1)

    await cleanupTenantData(tenant)
  })

  test('extracts rows and loose text from HTML tables', ({ assert }) => {
    const parsed = parseHtmlTables(`
      <html>
        <body>
          <table>
            <tr><th>Número do processo</th><th>Valor atualizado</th></tr>
            <tr><td>${VALID_CNJ}</td><td>45.000,00</td></tr>
          </table>
        </body>
      </html>
    `)

    assert.lengthOf(parsed.rows, 1)
    assert.equal(parsed.rows[0].numero_do_processo, VALID_CNJ)
    assert.equal(parsed.rows[0].valor_atualizado, '45.000,00')
    assert.include(parsed.text, 'Número do processo')
  })

  test('extracts candidate rows from PDF text using an injectable extractor', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const sourceRecord = await createSourceRecord(tenant, 'pdf', '%PDF fixture')

    const result = await tribunalDocumentExtractionService.extractSourceRecord(sourceRecord.id, {
      pdfTextExtractor: async () => `Ordem 1 ${VALID_CNJ} Valor R$ 77.000,10 Proposta 2025`,
    })

    assert.equal(result.format, 'pdf')
    assert.equal(result.status, 'extracted')
    assert.lengthOf(result.rows, 1)
    assert.equal(result.rows[0].normalizedCnj, VALID_CNJ)
    assert.equal(result.rows[0].normalizedValue, '77000.10')
    assert.equal(result.rows[0].normalizedYear, 2025)
    assert.include(result.text, 'Ordem 1')

    await cleanupTenantData(tenant)
  })

  test('parses delimited text with quoted separators', ({ assert }) => {
    const rows = parseDelimitedText(`Processo,Credor,Valor\n${VALID_CNJ},"Maria, Silva","1.200,00"`)

    assert.lengthOf(rows, 1)
    assert.equal(rows[0].credor, 'Maria, Silva')
    assert.equal(rows[0].valor, '1.200,00')
  })
})

async function createSourceRecord(tenant: Tenant, extension: 'csv' | 'pdf', contents: string) {
  const directory = app.makePath('storage', 'tests', 'tribunal-extraction', tenant.id)
  const filePath = join(directory, `source.${extension}`)

  await mkdir(directory, { recursive: true })
  await writeFile(filePath, contents)

  return SourceRecord.create({
    tenantId: tenant.id,
    source: 'tribunal',
    sourceUrl: `https://example.test/source.${extension}`,
    sourceFilePath: filePath,
    originalFilename: `source.${extension}`,
    mimeType: extension === 'pdf' ? 'application/pdf' : 'text/csv',
    sourceChecksum: `${extension}-${tenant.id}`,
    collectedAt: DateTime.now(),
    rawData: {
      providerId: 'test-tribunal',
      recordKind: 'attached_document',
    },
  })
}

async function cleanupTenantData(tenant: Tenant) {
  await SourceRecord.query().where('tenant_id', tenant.id).delete()
  await rm(app.makePath('storage', 'tests', 'tribunal-extraction', tenant.id), {
    recursive: true,
    force: true,
  })
  await tenant.delete()
}
