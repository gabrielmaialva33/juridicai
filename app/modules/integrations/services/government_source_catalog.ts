export type FederativeLevel = 'federal' | 'state' | 'municipal' | 'multi_level'

export type GovernmentSourceKind =
  | 'open_data_file'
  | 'soap_webservice'
  | 'public_search_api'
  | 'tribunal_publication'

export type GovernmentSourceAccess = 'public' | 'credentialed' | 'certificate'

export type GovernmentSourceRecord = {
  id: string
  name: string
  owner: string
  levels: FederativeLevel[]
  source: 'siop' | 'datajud' | 'tribunal'
  kind: GovernmentSourceKind
  access: GovernmentSourceAccess
  priority: 'primary' | 'enrichment' | 'cross_check'
  baseUrl: string
  notes: string
  constraints: string[]
  courtAliases?: string[]
}

const DATAJUD_SUPERIOR_ALIASES = ['tst', 'tse', 'stj', 'stm'] as const

const DATAJUD_TRF_ALIASES = ['trf1', 'trf2', 'trf3', 'trf4', 'trf5', 'trf6'] as const

const DATAJUD_TJ_ALIASES = [
  'tjac',
  'tjal',
  'tjam',
  'tjap',
  'tjba',
  'tjce',
  'tjdft',
  'tjes',
  'tjgo',
  'tjma',
  'tjmg',
  'tjms',
  'tjmt',
  'tjpa',
  'tjpb',
  'tjpe',
  'tjpi',
  'tjpr',
  'tjrj',
  'tjrn',
  'tjro',
  'tjrr',
  'tjrs',
  'tjsc',
  'tjse',
  'tjsp',
  'tjto',
] as const

const DATAJUD_TRT_ALIASES = [
  'trt1',
  'trt2',
  'trt3',
  'trt4',
  'trt5',
  'trt6',
  'trt7',
  'trt8',
  'trt9',
  'trt10',
  'trt11',
  'trt12',
  'trt13',
  'trt14',
  'trt15',
  'trt16',
  'trt17',
  'trt18',
  'trt19',
  'trt20',
  'trt21',
  'trt22',
  'trt23',
  'trt24',
] as const

const DATAJUD_TRE_ALIASES = [
  'tre-ac',
  'tre-al',
  'tre-am',
  'tre-ap',
  'tre-ba',
  'tre-ce',
  'tre-dft',
  'tre-es',
  'tre-go',
  'tre-ma',
  'tre-mg',
  'tre-ms',
  'tre-mt',
  'tre-pa',
  'tre-pb',
  'tre-pe',
  'tre-pi',
  'tre-pr',
  'tre-rj',
  'tre-rn',
  'tre-ro',
  'tre-rr',
  'tre-rs',
  'tre-sc',
  'tre-se',
  'tre-sp',
  'tre-to',
] as const

const DATAJUD_STATE_MILITARY_ALIASES = ['tjmmg', 'tjmrs', 'tjmsp'] as const

export const governmentSourceCatalog: GovernmentSourceRecord[] = [
  {
    id: 'siop-open-data-precatorios',
    name: 'SIOP Precatórios Dados Abertos',
    owner: 'Secretaria de Orçamento Federal / Ministério do Planejamento e Orçamento',
    levels: ['federal'],
    source: 'siop',
    kind: 'open_data_file',
    access: 'public',
    priority: 'primary',
    baseUrl:
      'https://www.gov.br/planejamento/pt-br/assuntos/orcamento/precatorios-content/painel-precatorios/dados-abertos',
    notes:
      'Canonical public ingestion source for federal precatorios and RPVs. Published as open data from SIOP, with annual expedition files and historical budget perspective.',
    constraints: [
      'Discovery must follow the official landing page links because annual file URLs can change.',
      'Beneficiary direct identifiers are intentionally absent from the public federal open dataset.',
      'Files must be stored as source_records before normalization.',
    ],
  },
  {
    id: 'siop-soap-wsprecatorios',
    name: 'SIOP WSPrecatorios',
    owner: 'Secretaria de Orçamento Federal / Ministério do Planejamento e Orçamento',
    levels: ['federal'],
    source: 'siop',
    kind: 'soap_webservice',
    access: 'certificate',
    priority: 'cross_check',
    baseUrl: 'https://webservice.siop.gov.br/services/precatorios/WSPrecatorios?wsdl',
    notes:
      'SOAP XML service used by courts to include or delete yearly precatorio information in SIOP. It is not the default public ingestion path.',
    constraints: [
      'Requires client certificate and SIOP credential payload.',
      'Service availability follows official SOF reporting windows.',
      'Use only for credentialed integrations, not for public backfill.',
    ],
  },
  {
    id: 'datajud-public-api',
    name: 'CNJ DataJud Public API',
    owner: 'Conselho Nacional de Justiça',
    levels: ['federal', 'state', 'municipal', 'multi_level'],
    source: 'datajud',
    kind: 'public_search_api',
    access: 'public',
    priority: 'enrichment',
    baseUrl: 'https://api-publica.datajud.cnj.jus.br',
    notes:
      'Process metadata enrichment source across court aliases. It does not replace SIOP/open precatorio datasets, but links assets to lawsuits and movements.',
    constraints: [
      'Query per court alias; there is no single universal search endpoint for all courts.',
      'Responses protect confidential cases and party-sensitive information.',
      'Store raw payloads separately from normalized precatorio asset fields.',
    ],
    courtAliases: [
      ...DATAJUD_SUPERIOR_ALIASES,
      ...DATAJUD_TRF_ALIASES,
      ...DATAJUD_TJ_ALIASES,
      ...DATAJUD_TRT_ALIASES,
      ...DATAJUD_TRE_ALIASES,
      ...DATAJUD_STATE_MILITARY_ALIASES,
    ],
  },
  {
    id: 'cnj-annual-precatorios-map',
    name: 'CNJ Mapa Anual dos Precatórios',
    owner: 'Conselho Nacional de Justiça',
    levels: ['federal', 'state', 'municipal', 'multi_level'],
    source: 'tribunal',
    kind: 'tribunal_publication',
    access: 'public',
    priority: 'cross_check',
    baseUrl: 'https://www.cnj.jus.br/sistema-de-gestao-de-precatorios/',
    notes:
      'National annual consolidation fed by courts. Use as aggregate validation and coverage control for Union, state, DF and municipal debts.',
    constraints: [
      'The submission system is restricted to courts; public access is usually through CNJ publications and court transparency pages.',
      'Granularity may be aggregate depending on the published year and court.',
    ],
  },
  {
    id: 'cjf-trf-precatorios-pages',
    name: 'CJF/TRF Precatórios and RPVs public pages',
    owner: 'Conselho da Justiça Federal and Federal Regional Courts',
    levels: ['federal'],
    source: 'tribunal',
    kind: 'tribunal_publication',
    access: 'public',
    priority: 'enrichment',
    baseUrl: 'https://www.cjf.jus.br/publico/rpvs_precatorios/',
    notes:
      'Federal court public consultation and payment-status surface. Use for enrichment and reconciliation after SIOP open-data ingestion.',
    constraints: [
      'Each TRF can expose a different search surface and data shape.',
      'Some queries require process number, CPF/CNPJ, party name, or lawyer OAB and may include PII-sensitive paths.',
    ],
  },
  {
    id: 'court-annual-map-pages',
    name: 'Court annual precatorio map publications',
    owner: 'State, federal, and labor courts',
    levels: ['state', 'municipal', 'multi_level'],
    source: 'tribunal',
    kind: 'tribunal_publication',
    access: 'public',
    priority: 'primary',
    baseUrl: 'https://www.cnj.jus.br/sistema-de-gestao-de-precatorios/',
    notes:
      'Primary discovery lane for state and municipal precatorio debt until SisPreq exposes a stable public integration surface.',
    constraints: [
      'Requires per-court adapters because transparency pages can be HTML, PDF, XLS, XLSX, or dashboard embeds.',
      'Municipal debts may appear through TJ/TRF/TRT maps depending on the court that issued the requisition.',
      'Never assume one state-level endpoint covers municipalities inside that state.',
    ],
  },
]

class GovernmentSourceCatalogService {
  list() {
    return governmentSourceCatalog
  }

  find(id: string) {
    return governmentSourceCatalog.find((source) => source.id === id) ?? null
  }

  listByLevel(level: FederativeLevel) {
    return governmentSourceCatalog.filter((source) => source.levels.includes(level))
  }

  primaryForLevel(level: FederativeLevel) {
    return this.listByLevel(level).filter((source) => source.priority === 'primary')
  }

  dataJudEndpoint(alias: string) {
    const normalized = alias.trim().toLowerCase()
    const source = this.find('datajud-public-api')

    if (!source?.courtAliases?.includes(normalized)) {
      return null
    }

    return `${source.baseUrl}/api_publica_${normalized}/_search`
  }
}

export default new GovernmentSourceCatalogService()
