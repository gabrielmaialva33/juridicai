import { rm } from 'node:fs/promises'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import tjesLupPrecatorioApiAdapter from '#modules/integrations/services/tjes_lup_precatorio_api_adapter'
import SourceRecord from '#modules/siop/models/source_record'
import { TenantFactory } from '#database/factories/tenant_factory'

const DEBTORS_URL = 'https://sistemas.tjes.jus.br/lup/lup/entidades_devedoras'
const PAGE_URL =
  'https://sistemas.tjes.jus.br/lup/lup/precatorios?cd_entidade_devedora=2259&fl_eh_ultima_importacao=S&page=0&size=2'

test.group('TJES LUP precatorio API adapter', () => {
  test('persists paged TJES LUP API responses as source records', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const fetcher = async (url: string | URL | Request) => {
      const value = String(url)

      if (value === DEBTORS_URL) {
        return jsonResponse([
          {
            cd_entidade: 2259,
            de_nome_entidade: 'ESTADO DO ESPÍRITO SANTO',
            fl_regime_especial: 'N',
          },
        ])
      }

      if (value === PAGE_URL) {
        return jsonResponse({
          total: 1,
          valor_total: 65481.86,
          results: [
            {
              ordem: 1,
              cd_precatorio: '00036528920248080000',
              cd_precatorio_original: '00036528920248080000',
              cd_tribunal: 8,
              nu_ano_orcamento: 2026,
              dt_expedicao: '2024-11-08T15:10:04',
              cd_natureza: 'A',
              nu_acao: '50231845720228080024',
              de_entidade_devedora: 'ESTADO DO ESPÍRITO SANTO',
              vl_atualizado: 65481.86,
              cd_entidade_devedora: 2259,
            },
          ],
        })
      }

      return new Response('not found', { status: 404 })
    }

    const result = await tjesLupPrecatorioApiAdapter.sync({
      tenantId: tenant.id,
      fetcher,
      debtorLimit: 1,
      pageSize: 2,
      maxPagesPerDebtor: 1,
    })

    assert.equal(result.debtorsDiscovered, 1)
    assert.equal(result.debtorsFetched, 1)
    assert.equal(result.pagesFetched, 1)
    assert.equal(result.sourceRecordsCreated, 1)
    assert.equal(result.totalElements, 1)

    const sourceRecord = await SourceRecord.query()
      .where('tenant_id', tenant.id)
      .where('source_url', PAGE_URL)
      .firstOrFail()
    assert.equal(sourceRecord.rawData?.providerId, 'tjes-lup-api')
    assert.deepEqual(sourceRecord.rawData?.debtor, {
      cd_entidade: 2259,
      de_nome_entidade: 'ESTADO DO ESPÍRITO SANTO',
      fl_regime_especial: 'N',
    })

    const secondRun = await tjesLupPrecatorioApiAdapter.sync({
      tenantId: tenant.id,
      fetcher,
      debtorLimit: 1,
      pageSize: 2,
      maxPagesPerDebtor: 1,
    })
    assert.equal(secondRun.sourceRecordsCreated, 0)

    await tenant.delete()
    await rm(app.makePath('storage', 'tribunal', 'tjes', tenant.id), {
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
