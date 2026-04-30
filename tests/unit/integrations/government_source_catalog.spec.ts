import { test } from '@japa/runner'
import governmentSourceCatalog from '#modules/integrations/services/government_source_catalog'

test.group('Government source catalog', () => {
  test('uses SIOP open data as the primary federal ingestion source', ({ assert }) => {
    const primarySources = governmentSourceCatalog.primaryForLevel('federal')

    assert.isTrue(primarySources.some((source) => source.id === 'siop-open-data-precatorios'))
    assert.isFalse(primarySources.some((source) => source.id === 'siop-soap-wsprecatorios'))
  })

  test('keeps state and municipal discovery on court publication adapters', ({ assert }) => {
    const stateSources = governmentSourceCatalog.primaryForLevel('state')
    const municipalSources = governmentSourceCatalog.primaryForLevel('municipal')

    assert.sameDeepMembers(
      stateSources.map((source) => source.id),
      ['court-annual-map-pages']
    )
    assert.sameDeepMembers(
      municipalSources.map((source) => source.id),
      ['court-annual-map-pages']
    )
  })

  test('builds DataJud endpoints for known court aliases', ({ assert }) => {
    assert.equal(
      governmentSourceCatalog.dataJudEndpoint('TRF1'),
      'https://api-publica.datajud.cnj.jus.br/api_publica_trf1/_search'
    )
    assert.equal(
      governmentSourceCatalog.dataJudEndpoint('tjsp'),
      'https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search'
    )
    assert.equal(
      governmentSourceCatalog.dataJudEndpoint('stj'),
      'https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search'
    )
    assert.equal(
      governmentSourceCatalog.dataJudEndpoint('tre-sp'),
      'https://api-publica.datajud.cnj.jus.br/api_publica_tre-sp/_search'
    )
    assert.equal(
      governmentSourceCatalog.dataJudEndpoint('tjmmg'),
      'https://api-publica.datajud.cnj.jus.br/api_publica_tjmmg/_search'
    )
    assert.isNull(governmentSourceCatalog.dataJudEndpoint('unknown-court'))
  })
})
