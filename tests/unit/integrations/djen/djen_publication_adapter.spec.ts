import { test } from '@japa/runner'
import djenPublicationAdapter from '#modules/integrations/services/djen_publication_adapter'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetSourceLink from '#modules/precatorios/models/asset_source_link'
import ExternalIdentifier from '#modules/precatorios/models/external_identifier'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import Publication from '#modules/precatorios/models/publication'
import PublicationEvent from '#modules/precatorios/models/publication_event'
import SourceRecord from '#modules/siop/models/source_record'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import type Tenant from '#modules/tenant/models/tenant'

const DJEN_COMMUNICATION = {
  id: 500001,
  data_disponibilizacao: '2026-05-01',
  siglaTribunal: 'TRF1',
  tipoComunicacao: 'Intimação',
  nomeOrgao: '1a Vara Federal Cível da SJDF',
  idOrgao: 123,
  texto: 'Fica a parte intimada: pagamento disponibilizado nos autos do precatório.',
  numero_processo: '00012349420244013400',
  meio: 'D',
  link: 'https://comunica.pje.jus.br/consulta/500001',
  tipoDocumento: 'Comunicação',
  nomeClasse: 'Precatório',
  codigoClasse: '1265',
  numeroComunicacao: 900001,
  ativo: true,
  hash: 'djen-fixture-hash-500001',
  datadisponibilizacao: '01/05/2026',
  meiocompleto: 'Diário de Justiça Eletrônico Nacional',
  numeroprocessocommascara: '0001234-94.2024.4.01.3400',
  destinatarios: [{ nome: 'JOSE DA SILVA' }],
  destinatarioadvogados: [{ nome: 'MARIA ADVOGADA', uf_oab: 'DF', numero_oab: '12345' }],
}

test.group('DJEN publication adapter', () => {
  test('persists communications as publications and source evidence idempotently', async ({
    assert,
  }) => {
    const tenant = await TenantFactory.create()
    const asset = await PrecatorioAssetFactory.merge({
      tenantId: tenant.id,
      source: 'siop',
      cnjNumber: '0001234-94.2024.4.01.3400',
      courtCode: 'TRF1',
      courtName: 'Tribunal Regional Federal da 1a Região',
    }).create()
    const requests: string[] = []
    const fetcher = fakeDjenFetch(requests, [djenResponse([DJEN_COMMUNICATION])])

    const firstRun = await djenPublicationAdapter.sync({
      tenantId: tenant.id,
      siglaTribunal: 'TRF1',
      dataDisponibilizacaoInicio: '2026-05-01',
      dataDisponibilizacaoFim: '2026-05-01',
      maxPages: 1,
      fetcher,
    })
    const secondRun = await djenPublicationAdapter.sync({
      tenantId: tenant.id,
      siglaTribunal: 'TRF1',
      dataDisponibilizacaoInicio: '2026-05-01',
      dataDisponibilizacaoFim: '2026-05-01',
      maxPages: 1,
      fetcher: fakeDjenFetch([], [djenResponse([DJEN_COMMUNICATION])]),
    })

    assert.include(firstRun, {
      requestedPages: 1,
      count: 1,
      fetched: 1,
      sourceRecordsCreated: 1,
      processesCreated: 1,
      publicationsCreated: 1,
      linkedAssets: 1,
    })
    assert.include(firstRun.publicationSignals, {
      matchedSignals: 1,
      publicationEventsUpserted: 1,
      assetEventsUpserted: 1,
      assetScoresRefreshed: 1,
    })
    assert.include(secondRun, {
      requestedPages: 1,
      sourceRecordsReused: 1,
      processesUpdated: 1,
      publicationsUpdated: 1,
      linkedAssets: 1,
    })

    assert.match(requests[0], /siglaTribunal=TRF1/)
    assert.match(requests[0], /itensPorPagina=100/)

    const sourceRecord = await SourceRecord.query()
      .where('tenant_id', tenant.id)
      .where('source', 'djen')
      .firstOrFail()
    const judicialProcess = await JudicialProcess.query()
      .where('tenant_id', tenant.id)
      .where('source', 'djen')
      .preload('court')
      .preload('judicialClass')
      .firstOrFail()
    const publication = await Publication.query()
      .where('tenant_id', tenant.id)
      .where('source', 'djen')
      .firstOrFail()
    const publicationEvents = await PublicationEvent.query().where('tenant_id', tenant.id)
    const assetEvents = await AssetEvent.query()
      .where('tenant_id', tenant.id)
      .where('asset_id', asset.id)
      .where('event_type', 'payment_available')
    const links = await AssetSourceLink.query().where('tenant_id', tenant.id)
    const identifiers = await ExternalIdentifier.query()
      .where('tenant_id', tenant.id)
      .orderBy('identifier_type', 'asc')

    assert.isNotNull(sourceRecord.sourceDatasetId)
    assert.equal(judicialProcess.assetId, asset.id)
    assert.equal(judicialProcess.sourceRecordId, sourceRecord.id)
    assert.equal(judicialProcess.cnjNumber, '0001234-94.2024.4.01.3400')
    assert.equal(judicialProcess.court.code, 'TRF1')
    assert.equal(judicialProcess.judicialClass.code, 1265)
    assert.equal(publication.assetId, asset.id)
    assert.equal(publication.processId, judicialProcess.id)
    assert.equal(publication.sourceRecordId, sourceRecord.id)
    assert.equal(publication.publicationDate.toISODate(), '2026-05-01')
    assert.lengthOf(publicationEvents, 1)
    assert.equal(publicationEvents[0].eventType, 'payment_available')
    assert.lengthOf(assetEvents, 1)
    assert.equal(assetEvents[0].payload?.publicationId, publication.id)
    assert.lengthOf(links, 1)
    assert.equal(links[0].linkType, 'enrichment')
    assert.deepEqual(
      identifiers.map((identifier) => identifier.identifierType),
      ['cnj_number', 'source_external_id']
    )
    assert.equal(await countSourceRecords(tenant.id), 1)
    assert.equal(await countJudicialProcesses(tenant.id), 1)
    assert.equal(await countPublications(tenant.id), 1)
    assert.equal(await countPublicationEvents(tenant.id), 1)
    assert.equal(await countAssetEvents(tenant.id), 1)

    await cleanupTenantData(tenant)
  })
})

function fakeDjenFetch(requests: string[], responses: Record<string, unknown>[]) {
  let index = 0

  return async (input: string | URL | Request) => {
    requests.push(String(input))

    return new Response(JSON.stringify(responses[index++] ?? djenResponse([])), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-ratelimit-limit': '60',
        'x-ratelimit-remaining': '59',
      },
    })
  }
}

function djenResponse(items: unknown[]) {
  return {
    status: 'success',
    message: 'success',
    count: items.length,
    items,
  }
}

async function cleanupTenantData(tenant: Tenant) {
  await tenant.delete()
}

async function countSourceRecords(tenantId: string) {
  const [result] = await SourceRecord.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}

async function countJudicialProcesses(tenantId: string) {
  const [result] = await JudicialProcess.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}

async function countPublications(tenantId: string) {
  const [result] = await Publication.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}

async function countPublicationEvents(tenantId: string) {
  const [result] = await PublicationEvent.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}

async function countAssetEvents(tenantId: string) {
  const [result] = await AssetEvent.query().where('tenant_id', tenantId).count('* as total')
  return Number(result.$extras.total)
}
