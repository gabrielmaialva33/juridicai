import { rm } from 'node:fs/promises'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import trf4PrecatorioAdapter, {
  TRF4_CHRONOLOGICAL_QUEUE_URL,
} from '#modules/integrations/services/trf4_precatorio_adapter'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

const TRF4_CSV = `
Notas explicativas:;;;;;;;;;;;
;;;;;;;;;;;
Nº de Ordem Cronológica; Proposta; Base legal para enquadramento na ordem cronológica; Número do Precatório; CPF/CNPJ parcial do beneficiário; Data de Autuação no TRF4; Atualizado Até; Parcela Devida; Valor Original Pago; Data Pagamento; Valor Pago;
1;2026;Alimentares, Art. 107 A, 8, Inciso II;5004648-80.2022.4.04.9388;109********;15/04/2022 19:05;abr/26;110.649,95;;;;
2;2026;Comuns;5004649-65.2022.4.04.9388;773********;16/04/2022 16:49;abr/26;45.443,75;;;;
`

test.group('TRF4 precatorio adapter', () => {
  test('discovers generated queue CSVs from the public TRF4 form', async ({ assert }) => {
    const links = await trf4PrecatorioAdapter.discover(fakeTrf4Fetch)

    assert.lengthOf(links, 3)
    assert.equal(links[0].kind, 'federal_budget')
    assert.equal(links[0].formValue, 'O')
    assert.equal(links[0].title, 'TRF4 ordem cronológica - Fazenda Pública Federal')
    assert.equal(
      links[0].url,
      'https://www.trf4.jus.br/trf4/salvar_como_txt.php?arq=precatorios_ordem_cronologica_O_20260502.csv'
    )
    assert.equal(links[0].generatedFilename, 'precatorios_ordem_cronologica_O_20260502.csv')
  })

  test('downloads each queue into distinct tribunal source records', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const result = await trf4PrecatorioAdapter.sync({
      tenantId: tenant.id,
      fetcher: fakeTrf4Fetch,
    })

    assert.equal(result.discovered, 3)
    assert.equal(result.selected, 3)
    assert.equal(result.downloaded, 3)
    assert.equal(result.items[0].parsedRows, 2)
    assert.equal(result.items[0].validCnjRows, 2)
    assert.equal(result.items[0].uniqueCnjNumbers, 2)
    assert.equal(result.items[1].parsedRows, 0)
    assert.equal(result.items[2].parsedRows, 0)

    const records = await SourceRecord.query()
      .where('tenant_id', tenant.id)
      .where('source', 'tribunal')
      .orderBy('original_filename')

    assert.lengthOf(records, 3)
    assert.sameMembers(
      records.map((record) => String(record.rawData?.sourceKind)),
      ['federal_budget', 'extra_budget_general', 'extra_budget_special']
    )
    assert.lengthOf(new Set(records.map((record) => record.sourceChecksum)), 3)

    const secondRun = await trf4PrecatorioAdapter.sync({
      tenantId: tenant.id,
      fetcher: fakeTrf4Fetch,
    })

    assert.isFalse(secondRun.items[0].sourceRecordCreated)
    assert.equal(await countSourceRecords(tenant.id), 3)

    await cleanupTenantTrf4Data(tenant)
  })
})

async function fakeTrf4Fetch(input: string | URL | Request, init?: RequestInit) {
  const url = String(input)

  if (url === TRF4_CHRONOLOGICAL_QUEUE_URL) {
    const body = String(init?.body ?? '')
    const formValue = new URLSearchParams(body).get('rdoTipo') ?? 'O'

    return new Response(
      `window.open('salvar_como_txt.php?arq=precatorios_ordem_cronologica_${formValue}_20260502.csv')`,
      {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }
    )
  }

  if (url.includes('_O_')) {
    return new Response(Buffer.from(TRF4_CSV, 'latin1'), {
      status: 200,
      headers: { 'content-type': 'text/csv; charset=windows-1252' },
    })
  }

  return new Response(Buffer.from(';;;;;;;;;;;\n', 'latin1'), {
    status: 200,
    headers: { 'content-type': 'text/csv; charset=windows-1252' },
  })
}

async function cleanupTenantTrf4Data(tenant: Tenant) {
  await SourceRecord.query().where('tenant_id', tenant.id).delete()
  await rm(app.makePath('storage', 'tribunal', 'trf4', tenant.id), {
    recursive: true,
    force: true,
  })
  await tenant.delete()
}

async function countSourceRecords(tenantId: string) {
  const [result] = await SourceRecord.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}
