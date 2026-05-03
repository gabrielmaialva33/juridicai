import { rm } from 'node:fs/promises'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import tjmaPrecatorioAdapter, {
  TJMA_PRECATORIO_LISTS_URL,
  parseTjmaCategoryLinks,
  parseTjmaPrecatorioLinks,
} from '#modules/integrations/services/tjma_precatorio_adapter'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

const STATE_PAGE_URL = 'https://www.tjma.jus.br/hotsite/prec/item/6848'
const SAO_LUIS_PAGE_URL = 'https://www.tjma.jus.br/hotsite/prec/item/6849'
const OTHER_DEBTORS_PAGE_URL = 'https://www.tjma.jus.br/hotsite/prec/item/6850'
const STATE_LIST_URL =
  'https://novogerenciador.tjma.jus.br/storage/arquivos/precatorios/estado_do_maranhao_administracao_direta_e_indireta_atualizada_ate_31032026_30_04_2026_18_10_25.pdf'
const SAO_LUIS_LIST_URL =
  'https://novogerenciador.tjma.jus.br/storage/arquivos/precatorios/lista_unificada_municipio_de_sao_luis_administracao_direta_e_indireta_ate_31032026_29_04_2026_14_49_20.pdf'

const LANDING_HTML = `
  <a href="/hotsite/prec/item/6848">Estado do Maranhão - Lista Cronológica</a>
  <a href="/hotsite/prec/item/6849">Município de São Luís - Lista Cronológica</a>
  <a href="/hotsite/prec/item/6850">Outros Municípios / Entes / Entidades - Lista Cronológica</a>
`

const STATE_PAGE_HTML = `
  <a href="${STATE_LIST_URL}">
    Lista Unificada Estado do Maranhão Administração Direta e Indireta Atualizada até 31.03.2026
  </a>
  <a href="https://novogerenciador.tjma.jus.br/storage/arquivos/precatorios/precatorios_pagos_ou_em_processo_de_pagamento_2025.pdf">
    Precatórios pagos ou em processo de pagamento 2025
  </a>
  <a href="https://novogerenciador.tjma.jus.br/storage/arquivos/precatorios/lote_de_acordo_direto_precatorios_2016.pdf">
    Lote de Acordo Direto Precatórios 2016
  </a>
  <a href="https://novogerenciador.tjma.jus.br/storage/arquivos/precatorios/lote_preferencial_precatorios_2025.pdf">
    Lote Preferencial Precatórios 2025
  </a>
  <a href="https://novogerenciador.tjma.jus.br/storage/arquivos/precatorios/alteracoes_na_lista_de_precatorios_2024.pdf">
    Alterações na lista de precatórios 2024
  </a>
`

const SAO_LUIS_PAGE_HTML = `
  <a href="${SAO_LUIS_LIST_URL}">
    Lista Unificada Município de São Luís Administração Direta e Indireta até 31.03.2026
  </a>
`

test.group('TJMA precatorio adapter', () => {
  test('discovers official TJMA category pages from the landing page', ({ assert }) => {
    const links = parseTjmaCategoryLinks(LANDING_HTML, TJMA_PRECATORIO_LISTS_URL)

    assert.deepEqual(
      links.map((link) => ({
        url: link.url,
        debtorGroup: link.debtorGroup,
      })),
      [
        { url: STATE_PAGE_URL, debtorGroup: 'state' },
        { url: SAO_LUIS_PAGE_URL, debtorGroup: 'sao_luis' },
        { url: OTHER_DEBTORS_PAGE_URL, debtorGroup: 'other_debtors' },
      ]
    )
  })

  test('classifies TJMA PDF reports by operational meaning', ({ assert }) => {
    const links = parseTjmaPrecatorioLinks(STATE_PAGE_HTML, STATE_PAGE_URL, 'state')

    assert.deepEqual(
      links.map((link) => ({
        kind: link.kind,
        year: link.year,
        debtorGroup: link.debtorGroup,
      })),
      [
        { kind: 'chronological_list', year: 2026, debtorGroup: 'state' },
        { kind: 'paid_or_payment_process', year: 2025, debtorGroup: 'state' },
        { kind: 'direct_agreement', year: 2016, debtorGroup: 'state' },
        { kind: 'preferential_lot', year: 2025, debtorGroup: 'state' },
        { kind: 'change_notice', year: 2024, debtorGroup: 'state' },
      ]
    )
  })

  test('downloads selected TJMA PDFs into source records idempotently', async ({ assert }) => {
    const tenant = await TenantFactory.create()

    const result = await tjmaPrecatorioAdapter.sync({
      tenantId: tenant.id,
      years: [2026],
      kinds: ['chronological_list'],
      limit: 2,
      fetcher: fakeTjmaFetch,
    })

    assert.equal(result.discovered, 6)
    assert.equal(result.selected, 2)
    assert.equal(result.downloaded, 2)
    assert.equal(result.sourceRecordsCreated, 2)

    const sourceRecords = await SourceRecord.query()
      .where('tenant_id', tenant.id)
      .where('source', 'tribunal')
      .orderBy('source_url', 'asc')

    assert.lengthOf(sourceRecords, 2)
    assert.deepEqual(
      sourceRecords.map((record) => ({
        courtAlias: record.rawData?.courtAlias,
        sourceKind: record.rawData?.sourceKind,
        debtorGroup: record.rawData?.debtorGroup,
        year: record.rawData?.year,
      })),
      [
        {
          courtAlias: 'tjma',
          sourceKind: 'chronological_list',
          debtorGroup: 'state',
          year: 2026,
        },
        {
          courtAlias: 'tjma',
          sourceKind: 'chronological_list',
          debtorGroup: 'sao_luis',
          year: 2026,
        },
      ]
    )

    const secondRun = await tjmaPrecatorioAdapter.sync({
      tenantId: tenant.id,
      years: [2026],
      kinds: ['chronological_list'],
      limit: 2,
      fetcher: fakeTjmaFetch,
    })

    assert.equal(secondRun.sourceRecordsCreated, 0)
    assert.equal(await countSourceRecords(tenant.id), 2)

    await cleanupTenantTjmaData(tenant)
  })
})

async function fakeTjmaFetch(input: string | URL | Request) {
  const url = String(input)

  if (url === TJMA_PRECATORIO_LISTS_URL) {
    return new Response(LANDING_HTML, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  if (url === STATE_PAGE_URL) {
    return new Response(STATE_PAGE_HTML, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  if (url === SAO_LUIS_PAGE_URL) {
    return new Response(SAO_LUIS_PAGE_HTML, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  if (url === OTHER_DEBTORS_PAGE_URL) {
    return new Response('', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  if (url.endsWith('.pdf')) {
    return new Response(Buffer.from('%PDF-1.4 fake TJMA'), {
      status: 200,
      headers: { 'content-type': 'application/pdf' },
    })
  }

  return new Response('not found', { status: 404 })
}

async function cleanupTenantTjmaData(tenant: Tenant) {
  await SourceRecord.query().where('tenant_id', tenant.id).delete()
  await rm(app.makePath('storage', 'tribunal', 'tjma', tenant.id), {
    recursive: true,
    force: true,
  })
  await tenant.delete()
}

async function countSourceRecords(tenantId: string) {
  const [result] = await SourceRecord.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}
