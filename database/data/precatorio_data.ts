/**
 * Dados reais de precatórios brasileiros para seeds
 * Baseado em pesquisa via Perplexity e Exa (Janeiro 2025)
 */

/**
 * Escritórios especializados em precatórios (dados reais)
 */
export const ESCRITORIOS_FAMOSOS = [
  {
    name: 'Corino Advogados Associados',
    subdomain: 'corino-adv',
    plan: 'enterprise' as const,
    description:
      'Especialistas em negociação de precatórios com R$ 350 milhões em compras realizadas',
    faturamento_anual: 40_000_000,
    especialidades: ['precatorios', 'negociacao', 'compra_venda'],
    owner: {
      full_name: 'Dr. Ricardo Corino',
      email: 'ricardo.corino@corino-adv.com.br',
      oab: 'SP 234.567',
    },
  },
  {
    name: 'Sandoval Filho Advocacia',
    subdomain: 'sandoval-adv',
    plan: 'pro' as const,
    description: 'Especializado em precatórios de servidores públicos e INSS',
    faturamento_anual: 15_000_000,
    especialidades: ['servidores_publicos', 'inss', 'previdenciario'],
    owner: {
      full_name: 'Dr. Sandoval Filho',
      email: 'sandoval@sandovalfilho.com.br',
      oab: 'SP 189.432',
    },
  },
  {
    name: 'Garrastazu & Associados',
    subdomain: 'garrastazu-adv',
    plan: 'pro' as const,
    description: 'Negociação extrajudicial de precatórios para evitar longas esperas',
    faturamento_anual: 12_000_000,
    especialidades: ['negociacao_extrajudicial', 'mediacao', 'desapropriacoes'],
    owner: {
      full_name: 'Dra. Helena Garrastazu',
      email: 'helena@garrastazu.adv.br',
      oab: 'PR 145.789',
    },
  },
  {
    name: 'Taborda & Associados',
    subdomain: 'taborda-adv',
    plan: 'pro' as const,
    description: 'Precatórios estaduais e municipais com foco em SP',
    faturamento_anual: 8_000_000,
    especialidades: ['estaduais', 'municipais', 'servidores'],
    owner: {
      full_name: 'Dra. Elisangela Taborda',
      email: 'elisangela@taborda.adv.br',
      oab: 'SP 483.310',
    },
  },
  {
    name: 'Silva Precatórios Advocacia',
    subdomain: 'silva-precatorios',
    plan: 'starter' as const,
    description: 'Escritório boutique especializado em INSS e trabalhistas',
    faturamento_anual: 5_000_000,
    especialidades: ['inss', 'trabalhista', 'previdenciario'],
    owner: {
      full_name: 'Dr. Paulo Silva',
      email: 'paulo@silva-precatorios.com.br',
      oab: 'RJ 312.456',
    },
  },
]

/**
 * Tipos de precatórios e suas características
 */
export const TIPOS_PRECATORIO = {
  federal: {
    case_type: 'administrative' as const,
    descricao: 'Precatório Federal',
    origem_comum: ['INSS', 'Servidores Federais', 'Autarquias Federais'],
    valor_minimo: 91_080, // 60 salários mínimos (2025)
    valor_medio: 250_000,
    valor_maximo: 2_000_000,
    prazo_medio_anos: 3,
    tribunais: ['TRF-1', 'TRF-2', 'TRF-3', 'TRF-4', 'TRF-5', 'TRF-6'],
    segmento_cnj: '4', // Justiça Federal
  },
  estadual: {
    case_type: 'administrative' as const,
    descricao: 'Precatório Estadual',
    origem_comum: ['Servidores Estaduais', 'Desapropriação', 'Saúde Pública'],
    valor_minimo: 91_080,
    valor_medio: 400_000,
    valor_maximo: 5_000_000,
    prazo_medio_anos: 13, // SP está pagando precatórios de 2011 em 2024
    tribunais: ['TJ-SP', 'TJ-RJ', 'TJ-MG', 'TJ-RS', 'TJ-BA', 'TJ-PR'],
    segmento_cnj: '8', // Justiça Estadual
  },
  municipal: {
    case_type: 'administrative' as const,
    descricao: 'Precatório Municipal',
    origem_comum: ['Servidores Municipais', 'Desapropriação', 'Obras Públicas'],
    valor_minimo: 91_080,
    valor_medio: 180_000,
    valor_maximo: 3_000_000,
    prazo_medio_anos: 14, // Municípios geralmente mais lentos que Estados
    tribunais: ['TJ-SP', 'TJ-RJ', 'TJ-MG', 'TJ-RS'],
    segmento_cnj: '8', // Justiça Estadual (competência)
  },
  trabalhista: {
    case_type: 'labor' as const,
    descricao: 'Precatório Trabalhista',
    origem_comum: ['Verbas Rescisórias', 'Horas Extras', 'Adicional Noturno'],
    valor_minimo: 91_080,
    valor_medio: 220_000,
    valor_maximo: 1_500_000,
    prazo_medio_anos: 4,
    tribunais: ['TRT-2', 'TRT-1', 'TRT-3', 'TRT-4', 'TRT-15'],
    segmento_cnj: '5', // Justiça do Trabalho
  },
}

/**
 * Tribunais com códigos CNJ reais
 */
export const TRIBUNAIS_CNJ = {
  // Tribunais Regionais Federais
  'TRF-1': {
    codigo: '01',
    nome: 'Tribunal Regional Federal da 1ª Região',
    estados: ['DF', 'GO', 'TO', 'MT', 'BA', 'PI', 'MA', 'PA', 'AM', 'AC', 'RO', 'RR', 'AP'],
  },
  'TRF-2': { codigo: '02', nome: 'Tribunal Regional Federal da 2ª Região', estados: ['RJ', 'ES'] },
  'TRF-3': { codigo: '03', nome: 'Tribunal Regional Federal da 3ª Região', estados: ['SP', 'MS'] },
  'TRF-4': {
    codigo: '04',
    nome: 'Tribunal Regional Federal da 4ª Região',
    estados: ['RS', 'PR', 'SC'],
  },
  'TRF-5': {
    codigo: '05',
    nome: 'Tribunal Regional Federal da 5ª Região',
    estados: ['CE', 'AL', 'SE', 'PB', 'PE', 'RN'],
  },
  'TRF-6': { codigo: '06', nome: 'Tribunal Regional Federal da 6ª Região', estados: ['MG'] },

  // Tribunais de Justiça Estaduais (principais)
  'TJ-SP': { codigo: '26', nome: 'Tribunal de Justiça de São Paulo', estados: ['SP'] },
  'TJ-RJ': { codigo: '19', nome: 'Tribunal de Justiça do Rio de Janeiro', estados: ['RJ'] },
  'TJ-MG': { codigo: '13', nome: 'Tribunal de Justiça de Minas Gerais', estados: ['MG'] },
  'TJ-RS': { codigo: '21', nome: 'Tribunal de Justiça do Rio Grande do Sul', estados: ['RS'] },
  'TJ-BA': { codigo: '05', nome: 'Tribunal de Justiça da Bahia', estados: ['BA'] },
  'TJ-PR': { codigo: '16', nome: 'Tribunal de Justiça do Paraná', estados: ['PR'] },

  // Tribunais Regionais do Trabalho (principais)
  'TRT-1': {
    codigo: '01',
    nome: 'Tribunal Regional do Trabalho da 1ª Região - RJ',
    estados: ['RJ'],
  },
  'TRT-2': {
    codigo: '02',
    nome: 'Tribunal Regional do Trabalho da 2ª Região - SP',
    estados: ['SP'],
  },
  'TRT-3': {
    codigo: '03',
    nome: 'Tribunal Regional do Trabalho da 3ª Região - MG',
    estados: ['MG'],
  },
  'TRT-4': {
    codigo: '04',
    nome: 'Tribunal Regional do Trabalho da 4ª Região - RS',
    estados: ['RS'],
  },
  'TRT-15': {
    codigo: '15',
    nome: 'Tribunal Regional do Trabalho da 15ª Região - Campinas',
    estados: ['SP'],
  },
}

/**
 * Partes comuns em processos de precatórios
 */
export const PARTES_PRECATORIO = {
  autores: {
    individual: [
      'Servidor Público aposentado',
      'Ex-servidor municipal',
      'Aposentado do INSS',
      'Beneficiário de pensão por morte',
      'Servidor estadual afastado',
      'Professor aposentado',
      'Policial militar reformado',
    ],
    juridica: [
      'Construtora (desapropriação)',
      'Empresa de transporte público',
      'Prestadora de serviços ao governo',
      'Fornecedora de equipamentos médicos',
    ],
  },
  reus: {
    federal: [
      'União Federal',
      'INSS - Instituto Nacional do Seguro Social',
      'Caixa Econômica Federal',
      'IBAMA',
      'ANATEL',
    ],
    estadual: [
      'Estado de São Paulo',
      'Estado do Rio de Janeiro',
      'Estado de Minas Gerais',
      'Fazenda do Estado',
      'Secretaria da Educação',
    ],
    municipal: [
      'Município de São Paulo',
      'Prefeitura Municipal do Rio de Janeiro',
      'Município de Belo Horizonte',
      'Município de Curitiba',
      'Fazenda Municipal',
    ],
  },
}

/**
 * Queries de AI comuns sobre precatórios (baseado em pesquisa Perplexity)
 */
export const QUERIES_AI_PRECATORIOS = {
  jurisprudencia: [
    'Precatórios complementares STF Tema 1360 jurisprudência recente',
    'Compensação de débitos tributários com precatórios LC 151/2015',
    'Ordem cronológica pagamento precatórios alimentares STJ',
    'Sequestro de verbas públicas precatórios vencidos STF',
    'Preferência idosos e portadores de doenças graves precatórios',
    'Precatórios requisitórios complementares mesma relação jurídica',
    'Atualização monetária precatórios IGP-DI vs IPCA jurisprudência',
    'Cessão de precatórios a terceiros requisitos formais STJ',
  ],
  legislacao: [
    'Emenda Constitucional 94/2016 regime especial precatórios',
    'Lei Complementar 151/2015 compensação débitos tributários',
    'Art 100 Constituição Federal ordem cronológica pagamento',
    'Lei 13.463/2017 parcelamento precatórios União',
    'Resolução CNJ 303/2019 gestão de precatórios',
    'CPC art 535 requisição de precatório procedimento',
  ],
  praticas: [
    'Como calcular valor atualizado de precatório INSS',
    'Prazos para requisição de precatório após trânsito em julgado',
    'Diferença entre RPV e precatório valores e procedimentos',
    'Documentos necessários para expedição de precatório',
    'Como acompanhar fila de precatórios no TJSP',
    'Cessão de precatório modelo de contrato e procedimento',
    'Imposto de renda sobre precatórios alimentares e comuns',
    'Negociação de precatório com ente público possibilidades',
  ],
  analise_documentos: [
    'Analisar minuta de cessão de precatório riscos e cláusulas essenciais',
    'Revisar petição inicial de ação que gerará precatório',
    'Gerar modelo de procuração para levantamento de precatório',
    'Analisar cálculo de liquidação de precatório correção monetária',
    'Revisar ofício requisitório de precatório completude',
  ],
}

/**
 * Tags comuns em casos de precatórios
 */
export const TAGS_PRECATORIOS = [
  'precatorio',
  'alimentar',
  'comum',
  'federal',
  'estadual',
  'municipal',
  'inss',
  'servidor-publico',
  'desapropriacao',
  'urgente',
  'idoso',
  'portador-doenca-grave',
  'cessao',
  'negociacao',
  'rpv',
  'complementar',
  'atrasado',
  'preferencial',
  'trabalhista',
]

/**
 * Eventos típicos em processos de precatórios
 */
export const EVENTOS_PRECATORIO = [
  {
    type: 'filing' as const,
    description: 'Propositura de ação judicial que originou o precatório',
    prazo_medio_dias: -1825, // ~5 anos atrás
  },
  {
    type: 'decision' as const,
    description: 'Sentença procedente condenando ente público',
    prazo_medio_dias: -1460, // ~4 anos atrás
  },
  {
    type: 'judgment' as const,
    description: 'Trânsito em julgado da decisão condenatória',
    prazo_medio_dias: -1095, // ~3 anos atrás
  },
  {
    type: 'other' as const,
    description: 'Apresentação de cálculo de liquidação',
    prazo_medio_dias: -1000,
  },
  {
    type: 'decision' as const,
    description: 'Homologação dos cálculos apresentados',
    prazo_medio_dias: -900,
  },
  {
    type: 'other' as const,
    description: 'Expedição de ofício requisitório de precatório',
    prazo_medio_dias: -730, // ~2 anos atrás
  },
  {
    type: 'publication' as const,
    description: 'Inclusão do precatório na lista de pagamento',
    prazo_medio_dias: -365, // ~1 ano atrás
  },
  {
    type: 'other' as const,
    description: 'Pagamento parcial do precatório (primeira parcela)',
    prazo_medio_dias: -90,
  },
  {
    type: 'settlement' as const,
    description: 'Pagamento integral do precatório',
    prazo_medio_dias: 0, // Futuro (pendente)
  },
]

/**
 * Documentos típicos em processos de precatórios
 */
export const DOCUMENTOS_PRECATORIO = [
  {
    type: 'petition' as const,
    title: 'Petição Inicial',
    description: 'Petição inicial da ação que originou o precatório',
  },
  {
    type: 'judgment' as const,
    title: 'Sentença Procedente',
    description: 'Sentença de procedência condenando ente público',
  },
  {
    type: 'judgment' as const,
    title: 'Acórdão Confirmando Condenação',
    description: 'Acórdão de tribunal confirmando sentença',
  },
  {
    type: 'evidence' as const,
    title: 'Certidão de Trânsito em Julgado',
    description: 'Certidão atestando o trânsito em julgado',
  },
  {
    type: 'report' as const,
    title: 'Cálculo de Liquidação',
    description: 'Memória de cálculo do valor devido atualizado',
  },
  {
    type: 'evidence' as const,
    title: 'Homologação dos Cálculos',
    description: 'Decisão homologatória dos cálculos apresentados',
  },
  {
    type: 'other' as const,
    title: 'Ofício Requisitório de Precatório',
    description: 'Ofício expedido pelo juízo requisitando pagamento',
  },
  {
    type: 'contract' as const,
    title: 'Contrato de Cessão de Precatório',
    description: 'Contrato de cessão do precatório a terceiro (se houver)',
  },
  {
    type: 'evidence' as const,
    title: 'Comprovante de Inclusão na Lista',
    description: 'Comprovante de inclusão na lista de precatórios a pagar',
  },
  {
    type: 'evidence' as const,
    title: 'Comprovante de Pagamento',
    description: 'Comprovante de depósito do valor do precatório',
  },
]
