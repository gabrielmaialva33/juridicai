import { rm } from 'node:fs/promises'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import tjbaPrecatorioApiAdapter from '#modules/integrations/services/tjba_precatorio_api_adapter'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'

const DEBTORS_URL = 'https://listaprecatoriosws.tjba.jus.br/api/entidade-devedora/'
const PAGE_URL =
  'https://listaprecatoriosws.tjba.jus.br/api/entidade-devedora/precatorios?cdunidade=0&numPrecatorio=&cRequerida=0&natureza=TODOS&mostrarTodos=false&page=1&size=2&grupoDados=TODOS'

test.group('TJBA precatorio API adapter', () => {
  test('persists paged TJBA API responses as source records', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const fetcher = async (url: string | URL | Request) => {
      const value = String(url)

      if (value === DEBTORS_URL) {
        return jsonResponse([
          {
            cdEntidade: 2,
            deEntidade: 'ESTADO DA BAHIA',
            tipoRegime: null,
            listaPrecatorio: null,
          },
        ])
      }

      if (value === PAGE_URL) {
        return jsonResponse({
          content: [
            {
              cdEntidade: null,
              deEntidade: null,
              tipoRegime: null,
              listaPrecatorio: [
                {
                  cdPrecatorio: '0013000-04.2013.805.0000-0',
                  cdEntidadeDevedora: 2,
                  deEntidadeDevedora: null,
                  nuAnoOrcamento: 2015,
                  cdNatureza: 'A',
                  dtExpedicao: [2013, 7, 23],
                  valorDevido: 67461.05,
                  ordemCronologica: 1,
                },
              ],
            },
          ],
          totalElements: 1,
          totalPages: 1,
          number: 1,
          size: 2,
          numberOfElements: 1,
          empty: false,
        })
      }

      return new Response('not found', { status: 404 })
    }

    const result = await tjbaPrecatorioApiAdapter.sync({
      tenantId: tenant.id,
      fetcher,
      pageSize: 2,
      maxPages: 1,
    })

    assert.equal(result.debtorsDiscovered, 1)
    assert.equal(result.pagesFetched, 1)
    assert.equal(result.sourceRecordsCreated, 1)

    const sourceRecord = await SourceRecord.query()
      .where('tenant_id', tenant.id)
      .where('source_url', PAGE_URL)
      .firstOrFail()
    assert.equal(sourceRecord.rawData?.providerId, 'tjba-precatorio-api')
    assert.deepEqual(sourceRecord.rawData?.debtorNamesByCode, { '2': 'ESTADO DA BAHIA' })

    const secondRun = await tjbaPrecatorioApiAdapter.sync({
      tenantId: tenant.id,
      fetcher,
      pageSize: 2,
      maxPages: 1,
    })
    assert.equal(secondRun.sourceRecordsCreated, 0)

    await tenant.delete()
    await rm(app.makePath('storage', 'tribunal', 'tjba', tenant.id), {
      recursive: true,
      force: true,
    })
  })
})

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
  })
}
