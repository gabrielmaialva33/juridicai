import { rm } from 'node:fs/promises'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import trf2PrecatorioAdapter, {
  TRF2_PRECATORIO_LANDING_URL,
  parseTrf2ChronologicalCsv,
  parseTrf2PrecatorioLinks,
} from '#modules/integrations/services/trf2_precatorio_adapter'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

const TRF2_HTML = `
  <a href="https://static.trf2.jus.br/nas-internet/documento/consultas/precatorios/divida/mapa-anual-divida-precatorios-trf2-2025.csv">
    Mapa anual da dívida de 2025 em CSV
  </a>
  <a href="https://static.trf2.jus.br/nas-internet/documento/consultas/precatorios/divida/2024/lista-ordem-cronologica-pagamento-precatorios-2024.csv">
    Precatórios pagos na proposta de 2024 em CSV
  </a>
  <a href="https://static.trf2.jus.br/nas-internet/documento/consultas/precatorios/divida/2024/lista-ordem-cronologica-pagamento-precatorios-2024.ods">
    Precatórios pagos na proposta de 2024 em ODS
  </a>
`

const TRF2_CSV = `
Notas explicativas:;;;;;;;;;;;
1) A ordem cronologica e continua.;;;;;;;;;;;
;;;;;;;;;;;
Nº de Ordem Cronológica; Proposta; Base legal para enquadramento na ordem cronológica; Número do Precatório; CPF/CNPJ parcial do beneficiário; Data de Autuação no TRF2; Atualizado Até; Parcela Devida; Valor Original Pago; Data Pagamento; Valor Pago;
1;2024;Alimentares, Art. 107 A, 8, Inciso II;5004648-37.2022.4.02.9388;109********;15/04/2022 19:05;abr/23;110.649,95;110.649,95;dez/23;113.128,50;
2;2024;Alimentares, Art. 107 A, 8, Inciso II;5004649-22.2022.4.02.9388;773********;16/04/2022 16:49;abr/23;45.443,75;45.443,75;dez/23;46.461,69;
`

test.group('TRF2 precatorio adapter', () => {
  test('discovers annual debt and paid precatorio CSV links', ({ assert }) => {
    const links = parseTrf2PrecatorioLinks(TRF2_HTML, TRF2_PRECATORIO_LANDING_URL)

    assert.lengthOf(links, 2)
    assert.deepInclude(links, {
      kind: 'annual_debt_map',
      title: 'Mapa anual da dívida de 2025 em CSV',
      url: 'https://static.trf2.jus.br/nas-internet/documento/consultas/precatorios/divida/mapa-anual-divida-precatorios-trf2-2025.csv',
      year: 2025,
    })
    assert.deepInclude(links, {
      kind: 'paid_precatorios',
      title: 'Precatórios pagos na proposta de 2024 em CSV',
      url: 'https://static.trf2.jus.br/nas-internet/documento/consultas/precatorios/divida/2024/lista-ordem-cronologica-pagamento-precatorios-2024.csv',
      year: 2024,
    })
  })

  test('parses chronological payment rows and CNJ numbers from CSV', ({ assert }) => {
    const rows = parseTrf2ChronologicalCsv(TRF2_CSV)

    assert.lengthOf(rows, 2)
    assert.equal(rows[0].chronologicalOrder, 1)
    assert.equal(rows[0].proposalYear, 2024)
    assert.equal(rows[0].precatorioNumber, '5004648-37.2022.4.02.9388')
    assert.equal(rows[0].cnjNumber, '5004648-37.2022.4.02.9388')
    assert.equal(rows[0].paidValue, '113128.50')
    assert.equal(rows[0].beneficiaryDocumentMasked, '109********')
  })

  test('downloads selected CSVs into tribunal source records and reports parsed CNJs', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()

    const result = await trf2PrecatorioAdapter.sync({
      tenantId: tenant.id,
      years: [2024],
      fetcher: fakeTrf2Fetch,
    })

    assert.equal(result.discovered, 2)
    assert.equal(result.selected, 1)
    assert.equal(result.downloaded, 1)
    assert.equal(result.items[0].parsedRows, 2)
    assert.equal(result.items[0].validCnjRows, 2)
    assert.equal(result.items[0].uniqueCnjNumbers, 2)

    const sourceRecord = await SourceRecord.query()
      .where('tenant_id', tenant.id)
      .where('source', 'tribunal')
      .firstOrFail()

    assert.equal(sourceRecord.rawData?.providerId, 'trf2-precatorios')
    assert.equal(sourceRecord.rawData?.courtAlias, 'trf2')
    assert.equal(sourceRecord.rawData?.sourceKind, 'paid_precatorios')

    const secondRun = await trf2PrecatorioAdapter.sync({
      tenantId: tenant.id,
      years: [2024],
      fetcher: fakeTrf2Fetch,
    })

    assert.equal(secondRun.items[0].sourceRecordCreated, false)
    assert.equal(await countSourceRecords(tenant.id), 1)

    await cleanupTenantTrf2Data(tenant)
  })
})

async function fakeTrf2Fetch(input: string | URL | Request) {
  const url = String(input)

  if (url === TRF2_PRECATORIO_LANDING_URL) {
    return new Response(TRF2_HTML, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  return new Response(Buffer.from(TRF2_CSV, 'latin1'), {
    status: 200,
    headers: { 'content-type': 'text/csv; charset=windows-1252' },
  })
}

async function cleanupTenantTrf2Data(tenant: Tenant) {
  await SourceRecord.query().where('tenant_id', tenant.id).delete()
  await rm(app.makePath('storage', 'tribunal', 'trf2', tenant.id), {
    recursive: true,
    force: true,
  })
  await tenant.delete()
}

async function countSourceRecords(tenantId: string) {
  const [result] = await SourceRecord.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}
