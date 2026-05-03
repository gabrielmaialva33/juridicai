import { test } from '@japa/runner'
import { parseTjmaPrecatorioPdfText } from '#modules/integrations/services/tjma_precatorio_pdf_parser'

const TJMA_TEXT = `
Lista de Ordem Cronológica do Estado do Maranhão
Atualizada até 28/02/2026

ESTADO DO MARANHÃO (Administração Direta e Indireta)                                                         REGIME ESPECIAL
Ordem                      Nº Precatório         Natureza     Orç.      Recebimento         Prioridade           Valor atualizado  Ente
    1                0806816-09.2023.8.10.0000   Alimentar    2024   30/03/2023 17:24:19   Doença Grave                135.803,94 ESTADO
    45               0002689-08.2016.8.10.0000   Alimentar    2017   24/11/2015 13:18:27      Idade                    162.100,00 ESTADO
`

test.group('TJMA precatorio PDF parser', () => {
  test('parses chronological queue rows with TJMA-specific fields', ({ assert }) => {
    const rows = parseTjmaPrecatorioPdfText(TJMA_TEXT, {
      sourceKind: 'chronological_list',
      debtorGroup: 'state',
      title: 'Lista de Ordem Cronológica do Estado do Maranhão',
      sourceUrl: 'https://example.test/tjma.pdf',
    })

    assert.lengthOf(rows, 2)
    assert.deepInclude(rows[0], {
      tribunal: 'TJMA',
      fonte_tipo: 'chronological_list',
      grupo_devedor: 'state',
      data_atualizacao_relatorio: '2026-02-28',
      regime_pagamento_relatorio: 'special',
      ordem: 1,
      numero_precatorio: '0806816-09.2023.8.10.0000',
      natureza: 'Alimentar',
      ano_orcamento: 2024,
      prioridade: 'Doença Grave',
      valor_atualizado: '135.803,94',
      ente_devedor: 'ESTADO',
    })
    assert.match(String(rows[0].recebido_em), /^2023-03-30T17:24:19/)
    assert.equal(rows[1].prioridade, 'Idade')
  })
})
