import factory from '@adonisjs/lucid/factories'
import { FactoryContextContract } from '@adonisjs/lucid/types/factory'
import PerplexitySearch from '#models/perplexity_search'
import { UserFactory } from './user_factory.js'
import { QUERIES_AI_PRECATORIOS } from '#database/seeders/helpers/precatorio_data'

/**
 * Generate realistic response for Perplexity search about precatórios
 */
function generatePrecatorioResponse(query: string, searchType: string): string {
  // Responses baseadas no tipo de pesquisa
  if (searchType === 'legal_research') {
    return `Com base na jurisprudência recente dos tribunais superiores, é possível destacar os seguintes pontos sobre "${query}":

**Jurisprudência Consolidada:**

O Supremo Tribunal Federal (STF), no julgamento do Tema 1360 da repercussão geral, estabeleceu importante precedente sobre precatórios complementares. A decisão consolidou o entendimento de que requisições complementares decorrentes de erro material ou de cálculo devem ser pagas seguindo a ordem cronológica original do precatório principal.

O Superior Tribunal de Justiça (STJ), por sua vez, tem reiterado que a compensação de débitos tributários com precatórios federais segue as regras da Lei Complementar 151/2015, exigindo a observância de requisitos formais específicos, incluindo a certidão de trânsito em julgado e a homologação dos cálculos.

**Aspectos Relevantes:**

1. **Ordem cronológica**: Mantém-se como regra fundamental (CF, art. 100), com exceções expressas apenas para credores idosos, portadores de doenças graves e precatórios de pequeno valor.

2. **Atualização monetária**: Os tribunais superiores têm aplicado índices oficiais de correção monetária (IPCA-E ou IGP-DI) conforme as regras vigentes à época da expedição do precatório.

3. **Preferência alimentar**: Precatórios de natureza alimentar mantêm preferência sobre os comuns, conforme entendimento pacífico do STJ.

**Fontes consultadas:**
- STF - Supremo Tribunal Federal (stf.jus.br)
- STJ - Superior Tribunal de Justiça (stj.jus.br)
- Tribunais Regionais Federais (TRF-1 a TRF-6)
- Tribunais de Justiça Estaduais

Última atualização: Janeiro 2025`
  }

  if (searchType === 'legislation') {
    return `A legislação brasileira sobre "${query}" está consolidada nos seguintes diplomas normativos:

**Legislação Federal:**

1. **Constituição Federal de 1988**
   - Art. 100: Estabelece o regime de precatórios e a ordem cronológica de pagamento
   - Art. 100, §1º: Define precatórios alimentares e sua preferência
   - Art. 100, §2º: Institui preferência para credores idosos e portadores de doenças graves

2. **Emenda Constitucional nº 94/2016**
   - Instituiu regime especial de pagamento de precatórios
   - Definiu limites e prazos para quitação de estoque
   - Estabeleceu mecanismos de compensação tributária

3. **Lei Complementar nº 151/2015**
   - Regulamenta a compensação de precatórios com débitos tributários
   - Define requisitos formais para cessão de precatórios
   - Estabelece limites e restrições à compensação

4. **Código de Processo Civil (Lei 13.105/2015)**
   - Arts. 534-535: Procedimento de expedição de precatórios
   - Arts. 910-912: Execução contra Fazenda Pública

**Resoluções do CNJ:**

- Resolução CNJ nº 303/2019: Regulamenta a gestão de precatórios pelos tribunais
- Resolução CNJ nº 115/2010: Institui o Sistema de Gestão de Precatórios

**Legislação Estadual e Municipal:**

Cada ente federativo pode ter legislação complementar regulamentando prazos e procedimentos internos, sempre respeitando a Constituição Federal.

Referências: Planalto.gov.br, CNJ.jus.br`
  }

  // Default: caso geral
  return `Análise sobre "${query}":

A questão levantada envolve aspectos importantes da sistemática de precatórios no ordenamento jurídico brasileiro. Precatórios são requisições de pagamento expedidas pelo Poder Judiciário contra a Fazenda Pública, decorrentes de condenações judiciais transitadas em julgado.

**Principais Aspectos:**

1. **Regime Jurídico**: Os precatórios seguem o regime constitucional previsto no art. 100 da CF/88, com alterações promovidas pelas ECs 62/2009 e 94/2016.

2. **Ordem de Pagamento**: A ordem cronológica de apresentação é a regra fundamental, com preferências constitucionais para créditos alimentares, credores idosos e portadores de doenças graves.

3. **Prazos**: O prazo constitucional para pagamento é até o final do exercício seguinte à inscrição do precatório na lista de pagamento, mas na prática os prazos são significativamente maiores devido ao volume de estoque.

4. **Atualização Monetária**: Os valores são corrigidos monetariamente desde a expedição até o efetivo pagamento, utilizando índices oficiais.

Esta análise fornece uma visão geral da matéria. Para casos específicos, recomenda-se consulta a advogado especializado em precatórios.

Fontes: Constituição Federal, legislação infraconstitucional, jurisprudência dos tribunais superiores.`
}

/**
 * Generate realistic search results for Perplexity queries
 */
function generateSearchResults(
  query: string,
  searchType: string
): Array<{
  title: string
  url: string
  date?: string
  snippet?: string
}> {
  const currentYear = new Date().getFullYear()
  const baseResults = []

  if (searchType === 'legal_research') {
    baseResults.push(
      {
        title: 'STF - Tema 1360 - Precatórios Complementares',
        url: 'https://portal.stf.jus.br/jurisprudencia/temas/1360',
        date: `${currentYear}-01-15`,
        snippet:
          'Decisão que estabelece critérios para pagamento de precatórios complementares decorrentes de erro material ou de cálculo...',
      },
      {
        title: 'STJ - Jurisprudência sobre Compensação de Precatórios',
        url: 'https://www.stj.jus.br/sites/portalp/Jurisprudencia',
        date: `${currentYear - 1}-11-20`,
        snippet:
          'Entendimentos consolidados sobre compensação de débitos tributários com precatórios federais conforme LC 151/2015...',
      },
      {
        title: 'CNJ - Resolução 303/2019 - Gestão de Precatórios',
        url: 'https://atos.cnj.jus.br/atos/detalhar/2889',
        date: `${currentYear - 5}-06-10`,
        snippet:
          'Regulamenta a gestão de precatórios pelos tribunais, incluindo ordem cronológica e preferências...',
      }
    )
  } else if (searchType === 'legislation') {
    baseResults.push(
      {
        title: 'Constituição Federal - Art. 100',
        url: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
        date: '1988-10-05',
        snippet:
          'Artigo 100 da CF estabelece o regime de precatórios e ordem cronológica de pagamento...',
      },
      {
        title: 'Emenda Constitucional 94/2016',
        url: 'https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc94.htm',
        date: '2016-12-15',
        snippet: 'Altera EC 62/2009 e institui regime especial de pagamento de precatórios...',
      },
      {
        title: 'Lei Complementar 151/2015',
        url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp151.htm',
        date: '2015-08-03',
        snippet:
          'Regulamenta a compensação de precatórios com débitos tributários da Fazenda Pública...',
      }
    )
  } else {
    baseResults.push(
      {
        title: 'CNJ - Sistema de Gestão de Precatórios',
        url: 'https://www.cnj.jus.br/sistemas/precatorios',
        date: `${currentYear}-01-10`,
        snippet: 'Informações sobre gestão e acompanhamento de precatórios judiciais...',
      },
      {
        title: 'Migalhas - Direito Financeiro e Precatórios',
        url: 'https://www.migalhas.com.br/coluna/precatorios',
        date: `${currentYear - 1}-12-15`,
        snippet: 'Artigos e análises sobre o regime jurídico dos precatórios...',
      }
    )
  }

  return baseResults
}

/**
 * Factory for Perplexity AI searches about precatórios
 */
export const PerplexitySearchFactory = factory
  .define(PerplexitySearch, async ({ faker }: FactoryContextContract) => {
    // Select a random query type and query
    const queryTypes = ['jurisprudencia', 'legislacao', 'praticas'] as const
    const queryType = faker.helpers.arrayElement(queryTypes)
    const query = faker.helpers.arrayElement(QUERIES_AI_PRECATORIOS[queryType])

    const searchType =
      queryType === 'jurisprudencia'
        ? 'legal_research'
        : queryType === 'legislacao'
          ? 'legislation'
          : 'general'

    return {
      query,
      response: generatePrecatorioResponse(query, searchType),
      search_type: searchType as
        | 'legal_research'
        | 'legislation'
        | 'case_analysis'
        | 'legal_writing'
        | 'general',
      model: 'sonar-pro',
      search_mode: searchType === 'legal_research' ? 'academic' : null,
      tokens_used: faker.number.int({ min: 800, max: 3000 }),
      prompt_tokens: faker.number.int({ min: 200, max: 800 }),
      completion_tokens: faker.number.int({ min: 600, max: 2200 }),
      metadata: {
        domain_filter:
          searchType === 'legal_research'
            ? ['stf.jus.br', 'stj.jus.br', 'cnj.jus.br', 'planalto.gov.br']
            : undefined,
        temperature: searchType === 'legal_research' ? 0.2 : 0.5,
        max_tokens: 2048,
        search_depth: searchType === 'legal_research' ? 'deep' : 'standard',
      },
      search_results: generateSearchResults(query, searchType),
      case_id: null, // Será associado ao criar com relacionamento
    }
  })
  .relation('user', () => UserFactory)

  // ==================== STATES POR TIPO DE PESQUISA ====================

  .state('jurisprudencia', (search, ctx) => {
    const { faker } = ctx
    const query = faker.helpers.arrayElement(QUERIES_AI_PRECATORIOS.jurisprudencia)

    search.query = query
    search.search_type = 'legal_research'
    search.search_mode = 'academic'
    search.response = generatePrecatorioResponse(query, 'legal_research')
    search.search_results = generateSearchResults(query, 'legal_research')
    search.metadata = {
      domain_filter: ['stf.jus.br', 'stj.jus.br', 'cnj.jus.br'],
      temperature: 0.2,
      max_tokens: 2048,
      court_filter: faker.helpers.arrayElement(['STF', 'STJ', 'TRF', 'TJ']),
    }
  })

  .state('legislacao', (search, ctx) => {
    const { faker } = ctx
    const query = faker.helpers.arrayElement(QUERIES_AI_PRECATORIOS.legislacao)

    search.query = query
    search.search_type = 'legislation'
    search.search_mode = null
    search.response = generatePrecatorioResponse(query, 'legislation')
    search.search_results = generateSearchResults(query, 'legislation')
    search.metadata = {
      domain_filter: ['planalto.gov.br', 'senado.leg.br', 'camara.leg.br'],
      temperature: 0.3,
      max_tokens: 1536,
    }
  })

  .state('praticas', (search, ctx) => {
    const { faker } = ctx
    const query = faker.helpers.arrayElement(QUERIES_AI_PRECATORIOS.praticas)

    search.query = query
    search.search_type = 'general'
    search.search_mode = null
    search.response = generatePrecatorioResponse(query, 'general')
    search.search_results = generateSearchResults(query, 'general')
    search.metadata = {
      temperature: 0.5,
      max_tokens: 1024,
    }
  })

  .state('analise_documento', (search, ctx) => {
    const { faker } = ctx
    const query = faker.helpers.arrayElement(QUERIES_AI_PRECATORIOS.analise_documentos)

    search.query = query
    search.search_type = 'case_analysis'
    search.search_mode = null
    search.response = generatePrecatorioResponse(query, 'case_analysis')
    search.search_results = []
    search.metadata = {
      temperature: 0.4,
      max_tokens: 2048,
      document_type: 'contract',
    }
  })

  // ==================== STATES POR TRIBUNAL ====================

  .state('stf', (search, ctx) => {
    search.metadata = {
      ...search.metadata,
      court_filter: 'STF',
      domain_filter: ['stf.jus.br', 'redir.stf.jus.br'],
    }
  })

  .state('stj', (search, ctx) => {
    search.metadata = {
      ...search.metadata,
      court_filter: 'STJ',
      domain_filter: ['stj.jus.br', 'ww2.stj.jus.br'],
    }
  })

  .state('trf', (search, ctx) => {
    const { faker } = ctx
    const trfRegiao = faker.number.int({ min: 1, max: 6 })

    search.metadata = {
      ...search.metadata,
      court_filter: `TRF-${trfRegiao}`,
      domain_filter: [`trf${trfRegiao}.jus.br`],
    }
  })

  .build()
