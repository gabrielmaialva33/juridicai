import factory from '@adonisjs/lucid/factories'
import { FactoryContextContract } from '@adonisjs/lucid/types/factory'
import NvidiaQuery from '#models/nvidia_query'
import { UserFactory } from './user_factory.js'
import { QUERIES_AI_PRECATORIOS } from '#database/data/precatorio_data'

/**
 * Generate realistic document analysis response for precatórios
 */
function generateDocumentAnalysisResponse(query: string): string {
  return `**ANÁLISE DE DOCUMENTO - PRECATÓRIO**

Com base na análise do documento fornecido, identifico os seguintes pontos relevantes:

**RESUMO EXECUTIVO:**

O documento analisado refere-se a um processo de precatório judicial contra a Fazenda Pública. Trata-se de requisição de pagamento decorrente de condenação transitada em julgado, nos termos do art. 100 da Constituição Federal.

**PARTES IDENTIFICADAS:**

- **Credor/Autor:** Servidor público aposentado / Beneficiário do INSS
- **Devedor/Réu:** Ente público (União, Estado ou Município)
- **Natureza do Crédito:** Alimentar (preferência constitucional)

**VALOR E ATUALIZAÇÃO:**

- Valor original: R$ 150.000,00 a R$ 500.000,00 (estimativa)
- Correção monetária: IPCA-E ou IGP-DI (conforme legislação aplicável)
- Juros moratórios: 1% ao mês ou conforme Resolução CNJ vigente
- Valor atualizado (estimativa): R$ 200.000,00 a R$ 750.000,00

**CRONOLOGIA PROCESSUAL IDENTIFICADA:**

1. Propositura da ação original (há ~5 anos)
2. Sentença de procedência (há ~4 anos)
3. Trânsito em julgado (há ~3 anos)
4. Liquidação e homologação dos cálculos (há ~2 anos)
5. Expedição do ofício requisitório (há ~1-2 anos)
6. Inclusão na lista de precatórios a pagar (há ~1 ano)
7. Status atual: Aguardando pagamento na fila

**OBRIGAÇÕES DAS PARTES:**

**Credor:**
- Manter dados cadastrais atualizados junto ao tribunal
- Informar eventual cessão do precatório
- Apresentar documentação para levantamento quando convocado

**Devedor (Fazenda Pública):**
- Incluir valor no orçamento do exercício seguinte
- Respeitar a ordem cronológica de pagamento
- Efetuar pagamento até 31 de dezembro do exercício seguinte à inclusão

**RISCOS IDENTIFICADOS:**

1. **RISCO ALTO - Prazo de Pagamento:**
   - Atraso médio de 10-15 anos em alguns estados (ex: São Paulo)
   - Possibilidade de parcelamento ou renegociação pelo ente devedor
   - Incerteza quanto ao cronograma efetivo de pagamento

2. **RISCO MÉDIO - Desvalorização:**
   - Perda do poder aquisitivo mesmo com correção monetária
   - Pressão para aceitação de propostas de cessão com deságio significativo

3. **RISCO BAIXO - Execução:**
   - Regime constitucional garante pagamento (não há prescrição do direito)
   - Possibilidade de sequestro de verbas em caso de descumprimento por mais de 2 anos

**CLÁUSULAS ESSENCIAIS (em caso de cessão):**

- Identificação completa das partes (cedente e cessionário)
- Número do processo e valor atualizado do precatório
- Percentual de cessão e valor da transação
- Responsabilidade por tributos e honorários advocatícios
- Anuência do credor original quando exigível
- Comunicação ao tribunal para alteração do beneficiário

**CONFORMIDADE LEGAL:**

✅ Documento está em conformidade com:
- Constituição Federal (Art. 100)
- CPC/2015 (Arts. 534-535)
- Emenda Constitucional 94/2016
- Resolução CNJ 303/2019

**RECOMENDAÇÕES:**

1. **Curto Prazo:** Acompanhar posição na fila de pagamento através do sistema do tribunal
2. **Médio Prazo:** Avaliar possibilidade de compensação tributária (LC 151/2015) se aplicável
3. **Longo Prazo:** Considerar cessão parcial para antecipação de recursos se necessário

**CONCLUSÃO:**

O documento analisado está formalmente adequado e em conformidade com a legislação aplicável. O principal risco identificado é o prazo de pagamento, que pode ser substancialmente superior ao prazo constitucional. Recomenda-se consultoria especializada para estratégias de monetização ou compensação.

*Esta análise foi gerada por IA e deve ser revisada por advogado especializado em precatórios.*`
}

/**
 * Generate realistic contract review response for precatórios
 */
function generateContractReviewResponse(query: string): string {
  return `**REVISÃO DE CONTRATO - CESSÃO DE PRECATÓRIO**

Análise detalhada do contrato de cessão de precatório apresentado:

**AVALIAÇÃO GERAL:**
⚠️ O contrato apresenta pontos que requerem atenção antes da assinatura.

**RISCOS IDENTIFICADOS:**

1. **ALTO - Deságio Excessivo:**
   - Valor ofertado: 65% do valor nominal
   - Deságio: 35% (acima da média de mercado: 15-25%)
   - **Recomendação:** Negociar percentual mínimo de 75%

2. **MÉDIO - Cláusula de Responsabilidade Tributária:**
   - Contrato atribui ao cedente 100% dos impostos
   - Normal é divisão proporcional ou responsabilidade do cessionário
   - **Recomendação:** Renegociar para responsabilidade do cessionário

3. **MÉDIO - Ausência de Cláusula de Prazo:**
   - Não especifica prazo para conclusão da transferência
   - Pode gerar indefinição e impossibilitar rescisão
   - **Recomendação:** Incluir prazo máximo de 60 dias

4. **BAIXO - Honorários Advocatícios:**
   - Prevê pagamento pelo cedente dos honorários de transferência
   - Valor não especificado pode gerar surpresas
   - **Recomendação:** Fixar limite ou percentual máximo

**CLÁUSULAS AUSENTES (mas essenciais):**

1. ❌ Cláusula de garantia de inexistência de ônus sobre o precatório
2. ❌ Cláusula de responsabilidade por atraso no pagamento pelo ente público
3. ❌ Cláusula de rescisão em caso de descumprimento
4. ❌ Cláusula de mediação/arbitragem para resolução de conflitos

**CONFORMIDADE LEGAL:**

✅ Atende requisitos da LC 151/2015 quanto à cessão
✅ Identifica corretamente o processo e valor do precatório
⚠️ Falta comprovação de inexistência de penhoras
⚠️ Não menciona comunicação ao tribunal (obrigatória)

**PROTEÇÃO DE DADOS (LGPD):**

✅ Cláusula de consentimento para tratamento de dados presente
⚠️ Falta especificação da finalidade e prazo de armazenamento

**RECOMENDAÇÕES PRIORITÁRIAS:**

1. **URGENTE:** Renegociar percentual de cessão (mínimo 75%)
2. **IMPORTANTE:** Incluir cláusula de prazo máximo (60 dias)
3. **IMPORTANTE:** Adicionar cláusulas ausentes listadas acima
4. **RECOMENDADO:** Esclarecer responsabilidade tributária
5. **RECOMENDADO:** Incluir cláusula de mediação/arbitragem

**COMPARAÇÃO COM MERCADO:**

Condições Típicas de Mercado (2025):
- Deságio médio: 15-25% (oferecido: 35%)
- Prazo de transferência: 30-60 dias (não especificado)
- Impostos: responsabilidade do cessionário (proposto: cedente)

**CONCLUSÃO:**

⚠️ **NÃO RECOMENDO ASSINATURA IMEDIATA**

O contrato apresenta condições desfavoráveis ao cedente, especialmente:
- Deságio acima da média de mercado
- Ausência de prazo definido
- Responsabilidade tributária integral do cedente
- Falta de cláusulas de proteção essenciais

**PRÓXIMOS PASSOS:**

1. Apresentar contraproposta com as modificações sugeridas
2. Solicitar ao menos 3 outras propostas para comparação
3. Consultar advogado especializado antes da assinatura final

*Esta revisão foi gerada por IA. Consulte advogado especializado em precatórios antes de assinar.*`
}

/**
 * Generate realistic code/template generation response
 */
function generateTemplateResponse(templateType: string): string {
  if (templateType === 'power_of_attorney') {
    return `**MODELO DE PROCURAÇÃO - LEVANTAMENTO DE PRECATÓRIO**

---

**PROCURAÇÃO AD JUDICIA**

**OUTORGANTE:** [Nome completo do titular do precatório], [nacionalidade], [estado civil], [profissão], portador(a) da Cédula de Identidade RG nº [número] e inscrito(a) no CPF sob nº [número], residente e domiciliado(a) na [endereço completo].

**OUTORGADO:** [Nome completo do advogado], brasileiro, advogado, inscrito na OAB/[UF] sob nº [número], com escritório profissional na [endereço do escritório].

**OBJETO:** Levantamento de precatório judicial expedido nos autos do Processo nº [número CNJ], que tramita perante [nome do tribunal].

**PODERES:** Pelo presente instrumento, o(a) OUTORGANTE confere ao(à) OUTORGADO(A) amplos e gerais poderes para:

1. Representar o(a) OUTORGANTE junto ao [Tribunal] e demais órgãos competentes;

2. Requerer, assinar e protocolar petições, recursos e demais documentos necessários ao levantamento do precatório;

3. Prestar declarações, fornecer informações e apresentar documentos em nome do(a) OUTORGANTE;

4. Receber intimações, notificações e demais comunicações processuais;

5. Fornecer dados bancários e cadastrais para depósito do valor do precatório;

6. Praticar todos os atos necessários ao fiel cumprimento deste mandato.

**CLÁUSULAS ESPECIAIS:**

a) Esta procuração é específica para o levantamento do precatório mencionado;

b) O percentual de honorários advocatícios está estabelecido em [X]% sobre o valor líquido recebido;

c) O prazo de validade desta procuração é de [X] meses a contar desta data;

d) Fica vedada a substabelecimento sem autorização expressa do(a) OUTORGANTE.

**DADOS DO PRECATÓRIO:**

- Processo: [número CNJ]
- Tribunal: [nome]
- Valor nominal: R$ [valor]
- Data de expedição: [data]
- Posição na fila: [número]

---

[Local], [data].

_________________________________
[Nome completo do OUTORGANTE]
CPF: [número]

**RECONHECER FIRMA**

---

*Este modelo foi gerado por IA e deve ser revisado por advogado antes do uso.*`
  }

  return `**MODELO DE DOCUMENTO - PRECATÓRIO**

[Documento gerado com base no tipo solicitado: ${templateType}]

Este modelo deve ser adaptado ao caso concreto e revisado por advogado especializado.`
}

/**
 * Factory for NVIDIA AI queries about precatórios
 */
export const NvidiaQueryFactory = factory
  .define(NvidiaQuery, async ({ faker }: FactoryContextContract) => {
    // Default: document analysis
    const query = faker.helpers.arrayElement(QUERIES_AI_PRECATORIOS.analise_documentos)

    return {
      query,
      response: generateDocumentAnalysisResponse(query),
      query_type: 'document_analysis' as const,
      model: 'qwen/qwen3-coder-480b-a35b-instruct',
      temperature: 0.7,
      top_p: 0.9,
      tokens_used: faker.number.int({ min: 1500, max: 4000 }),
      prompt_tokens: faker.number.int({ min: 500, max: 1200 }),
      completion_tokens: faker.number.int({ min: 1000, max: 2800 }),
      metadata: {
        analysis_type: 'full',
        document_type: 'precatorio',
        extract_parties: true,
        identify_risks: true,
      },
      case_id: null, // Será associado ao criar com relacionamento
    }
  })
  .relation('user', () => UserFactory)

  // ==================== STATES POR TIPO DE QUERY ====================

  .state('document_analysis', (nvidiaQuery, ctx) => {
    const { faker } = ctx
    const query = faker.helpers.arrayElement(QUERIES_AI_PRECATORIOS.analise_documentos)

    nvidiaQuery.query = query
    nvidiaQuery.query_type = 'document_analysis'
    nvidiaQuery.response = generateDocumentAnalysisResponse(query)
    nvidiaQuery.temperature = 0.7
    nvidiaQuery.metadata = {
      analysis_type: faker.helpers.arrayElement(['summary', 'full', 'detailed']),
      document_type: 'precatorio',
      extract_parties: true,
      identify_risks: true,
      extract_values: true,
    }
  })

  .state('contract_review', (nvidiaQuery, ctx) => {
    const { faker } = ctx
    const query =
      'Revisar contrato de cessão de precatório - identificar riscos e cláusulas abusivas'

    nvidiaQuery.query = query
    nvidiaQuery.query_type = 'contract_review'
    nvidiaQuery.response = generateContractReviewResponse(query)
    nvidiaQuery.temperature = 0.6
    nvidiaQuery.metadata = {
      review_focus: ['risks', 'missing_clauses', 'compliance'],
      contract_type: 'cessao_precatorio',
      check_compliance: true,
      laws: ['CF/88 Art 100', 'LC 151/2015', 'EC 94/2016'],
    }
  })

  .state('code_generation', (nvidiaQuery, ctx) => {
    const { faker } = ctx
    const templateType = faker.helpers.arrayElement([
      'power_of_attorney',
      'petition',
      'notification',
    ])

    const query = `Gerar modelo de ${templateType === 'power_of_attorney' ? 'procuração para levantamento de precatório' : templateType === 'petition' ? 'petição de habilitação de precatório' : 'notificação de cessão de precatório'}`

    nvidiaQuery.query = query
    nvidiaQuery.query_type = 'code_generation'
    nvidiaQuery.response = generateTemplateResponse(templateType)
    nvidiaQuery.temperature = 0.8
    nvidiaQuery.metadata = {
      template_type: templateType,
      context: 'precatorio',
      style: 'formal',
      include_clauses: true,
    }
  })

  .state('text_analysis', (nvidiaQuery, ctx) => {
    const { faker } = ctx
    const query =
      'Analisar ofício requisitório de precatório e extrair dados estruturados (valor, partes, tribunal, data)'

    nvidiaQuery.query = query
    nvidiaQuery.query_type = 'text_analysis'
    nvidiaQuery.response = JSON.stringify(
      {
        numero_processo: '0123456-78.2020.8.26.0100',
        tribunal: 'TJ-SP',
        valor_nominal: 'R$ 250.000,00',
        valor_atualizado: 'R$ 345.678,90',
        credor: 'João da Silva',
        devedor: 'Estado de São Paulo',
        natureza: 'Alimentar',
        data_expedicao: '15/06/2023',
        ano_base_orcamento: '2024',
      },
      null,
      2
    )
    nvidiaQuery.temperature = 0.4
    nvidiaQuery.metadata = {
      extraction_type: 'structured_data',
      fields_to_extract: ['numero_processo', 'tribunal', 'valor', 'partes', 'natureza', 'datas'],
    }
  })

  // ==================== STATES POR ANÁLISE ESPECÍFICA ====================

  .state('analise_cessao', (nvidiaQuery) => {
    nvidiaQuery.query = 'Analisar minuta de cessão de precatório - riscos e cláusulas essenciais'
    nvidiaQuery.query_type = 'contract_review'
    nvidiaQuery.response = generateContractReviewResponse(nvidiaQuery.query)
    nvidiaQuery.metadata = {
      ...nvidiaQuery.metadata,
      contract_type: 'cessao_precatorio',
      focus: ['deságio', 'prazo', 'tributos', 'rescisão'],
    }
  })

  .state('analise_calculo', (nvidiaQuery) => {
    nvidiaQuery.query = 'Analisar cálculo de liquidação de precatório - correção monetária e juros'
    nvidiaQuery.query_type = 'text_analysis'
    nvidiaQuery.metadata = {
      ...nvidiaQuery.metadata,
      extraction_type: 'financial_calculation',
      verify_indices: ['IPCA-E', 'IGP-DI', 'SELIC'],
      check_period: true,
    }
  })

  .state('gerar_procuracao', (nvidiaQuery) => {
    nvidiaQuery.query = 'Gerar modelo de procuração para levantamento de precatório'
    nvidiaQuery.query_type = 'code_generation'
    nvidiaQuery.response = generateTemplateResponse('power_of_attorney')
    nvidiaQuery.metadata = {
      ...nvidiaQuery.metadata,
      template_type: 'power_of_attorney',
      specific_powers: ['levantamento', 'recebimento', 'quitação'],
    }
  })

  .build()
