import { BaseSchema } from '@adonisjs/lucid/schema'

type TargetSeed = {
  key: string
  sourceDatasetKey: string
  name: string
  source: 'siop' | 'datajud' | 'djen' | 'tribunal'
  federativeLevel: 'federal' | 'state' | 'municipal' | 'multi_level'
  stateCode?: string | null
  courtAlias?: string | null
  branch: string
  priority: 'primary' | 'enrichment' | 'cross_check'
  adapterKey?: string | null
  sourceUrl?: string | null
  sourceFormat?: string | null
  status: 'implemented' | 'generic_supported' | 'manual_review' | 'blocked_captcha' | 'unknown'
  cadence: 'daily' | 'weekly' | 'monthly' | 'manual'
  coverageScore: string
  metadata?: Record<string, unknown> | null
}

const STATE_COURTS = [
  ['tjac', 'AC'],
  ['tjal', 'AL'],
  ['tjam', 'AM'],
  ['tjap', 'AP'],
  ['tjba', 'BA'],
  ['tjce', 'CE'],
  ['tjdft', 'DF'],
  ['tjes', 'ES'],
  ['tjgo', 'GO'],
  ['tjma', 'MA'],
  ['tjmg', 'MG'],
  ['tjms', 'MS'],
  ['tjmt', 'MT'],
  ['tjpa', 'PA'],
  ['tjpb', 'PB'],
  ['tjpe', 'PE'],
  ['tjpi', 'PI'],
  ['tjpr', 'PR'],
  ['tjrj', 'RJ'],
  ['tjrn', 'RN'],
  ['tjro', 'RO'],
  ['tjrr', 'RR'],
  ['tjrs', 'RS'],
  ['tjsc', 'SC'],
  ['tjse', 'SE'],
  ['tjsp', 'SP'],
  ['tjto', 'TO'],
] as const

const TRE_COURTS = [
  ['tre-ac', 'AC'],
  ['tre-al', 'AL'],
  ['tre-am', 'AM'],
  ['tre-ap', 'AP'],
  ['tre-ba', 'BA'],
  ['tre-ce', 'CE'],
  ['tre-dft', 'DF'],
  ['tre-es', 'ES'],
  ['tre-go', 'GO'],
  ['tre-ma', 'MA'],
  ['tre-mg', 'MG'],
  ['tre-ms', 'MS'],
  ['tre-mt', 'MT'],
  ['tre-pa', 'PA'],
  ['tre-pb', 'PB'],
  ['tre-pe', 'PE'],
  ['tre-pi', 'PI'],
  ['tre-pr', 'PR'],
  ['tre-rj', 'RJ'],
  ['tre-rn', 'RN'],
  ['tre-ro', 'RO'],
  ['tre-rr', 'RR'],
  ['tre-rs', 'RS'],
  ['tre-sc', 'SC'],
  ['tre-se', 'SE'],
  ['tre-sp', 'SP'],
  ['tre-to', 'TO'],
] as const

const DATAJUD_COURTS = [
  ...['tst', 'tse', 'stj', 'stm'].map((alias) => ({
    alias,
    stateCode: null,
    branch: 'superior',
    federativeLevel: 'federal' as const,
  })),
  ...['trf1', 'trf2', 'trf3', 'trf4', 'trf5', 'trf6'].map((alias) => ({
    alias,
    stateCode: null,
    branch: 'federal_regional',
    federativeLevel: 'federal' as const,
  })),
  ...STATE_COURTS.map(([alias, stateCode]) => ({
    alias,
    stateCode,
    branch: 'state_court',
    federativeLevel: 'state' as const,
  })),
  ...Array.from({ length: 24 }, (_, index) => ({
    alias: `trt${index + 1}`,
    stateCode: null,
    branch: 'labor_regional',
    federativeLevel: 'multi_level' as const,
  })),
  ...TRE_COURTS.map(([alias, stateCode]) => ({
    alias,
    stateCode,
    branch: 'electoral_regional',
    federativeLevel: 'state' as const,
  })),
  ...[
    ['tjmmg', 'MG'],
    ['tjmrs', 'RS'],
    ['tjmsp', 'SP'],
  ].map(([alias, stateCode]) => ({
    alias,
    stateCode,
    branch: 'state_military',
    federativeLevel: 'state' as const,
  })),
] as const

const SPECIFIC_TRIBUNAL_TARGETS: TargetSeed[] = [
  {
    key: 'tribunal:tjsp-precatorio-communications',
    sourceDatasetKey: 'tjsp-precatorio-communications',
    name: 'TJSP Comunicados de Precatórios',
    source: 'tribunal',
    federativeLevel: 'state',
    stateCode: 'SP',
    courtAlias: 'tjsp',
    branch: 'state_court',
    priority: 'primary',
    adapterKey: 'tjsp_precatorio_sync',
    sourceUrl: 'https://www.tjsp.jus.br/Precatorios/Precatorios/ListaGeral',
    sourceFormat: 'html/pdf/xls/xlsx',
    status: 'implemented',
    cadence: 'daily',
    coverageScore: '0.8500',
    metadata: {
      levels: ['state', 'municipal'],
      categories: ['state_entities', 'municipal_entities', 'inss', 'statistics'],
    },
  },
  {
    key: 'tribunal:trf2-chronological-precatorios',
    sourceDatasetKey: 'trf2-chronological-precatorios',
    name: 'TRF2 ordem cronológica de precatórios',
    source: 'tribunal',
    federativeLevel: 'federal',
    stateCode: null,
    courtAlias: 'trf2',
    branch: 'federal_regional',
    priority: 'enrichment',
    adapterKey: 'trf2_precatorio_sync',
    sourceUrl:
      'https://www.trf2.jus.br/trf2/consultas-e-servicos/precatorios-federais-requisicoes-de-pequeno-valor-rpvs',
    sourceFormat: 'csv',
    status: 'implemented',
    cadence: 'daily',
    coverageScore: '0.7500',
    metadata: {
      levels: ['federal'],
      importsCanonicalAssets: true,
    },
  },
  {
    key: 'tribunal:trf4-chronological-precatorios',
    sourceDatasetKey: 'trf4-chronological-precatorios',
    name: 'TRF4 ordem cronológica de precatórios',
    source: 'tribunal',
    federativeLevel: 'federal',
    stateCode: null,
    courtAlias: 'trf4',
    branch: 'federal_regional',
    priority: 'primary',
    adapterKey: 'trf4_precatorio_sync',
    sourceUrl:
      'https://www.trf4.jus.br/trf4/controlador.php?acao=consulta_precatorios_ordem_cronologica_externa',
    sourceFormat: 'csv',
    status: 'implemented',
    cadence: 'daily',
    coverageScore: '0.8500',
    metadata: {
      levels: ['federal'],
      queueKinds: ['federal_budget', 'extra_budget_general', 'extra_budget_special'],
      importsCanonicalAssets: true,
    },
  },
  {
    key: 'tribunal:trf5-precatorio-reports',
    sourceDatasetKey: 'trf5-precatorio-reports',
    name: 'TRF5 relatórios públicos de precatórios',
    source: 'tribunal',
    federativeLevel: 'federal',
    stateCode: null,
    courtAlias: 'trf5',
    branch: 'federal_regional',
    priority: 'primary',
    adapterKey: 'trf5_precatorio_sync',
    sourceUrl: 'https://rpvprecatorio.trf5.jus.br/mapa',
    sourceFormat: 'html/pdf',
    status: 'implemented',
    cadence: 'daily',
    coverageScore: '0.8000',
    metadata: {
      levels: ['federal', 'state', 'municipal'],
      reportKinds: [
        'paid_precatorios',
        'federal_debt',
        'state_municipal_chronological_order',
        'state_municipal_special_regime_ec94',
        'state_municipal_special_regime_ec136',
      ],
      importsCanonicalAssets: true,
    },
  },
  {
    key: 'tribunal:trf6-federal-precatorio-orders',
    sourceDatasetKey: 'trf6-federal-precatorio-orders',
    name: 'TRF6 ordem cronológica de precatórios federais',
    source: 'tribunal',
    federativeLevel: 'federal',
    stateCode: null,
    courtAlias: 'trf6',
    branch: 'federal_regional',
    priority: 'primary',
    adapterKey: 'trf6_precatorio_sync',
    sourceUrl: 'https://portal.trf6.jus.br/rpv-e-precatorios/precatorios-federais/',
    sourceFormat: 'html/pdf',
    status: 'implemented',
    cadence: 'daily',
    coverageScore: '0.7500',
    metadata: {
      levels: ['federal'],
      reportKinds: ['federal_budget_order'],
      importsCanonicalAssets: true,
      manualExportUrl:
        'https://eproc2g.trf6.jus.br/eproc/externo_controlador.php?acao=gerar_arquivo_precatorio&hash=7f9e1fbd97915e3bce36b6bd2528b0d3',
      blockedLinks: ['eproc_2026_captcha'],
    },
  },
]

export default class extends BaseSchema {
  protected tableName = 'government_source_targets'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('source_dataset_id')
        .notNullable()
        .references('id')
        .inTable('source_datasets')
        .onDelete('CASCADE')
      table.text('key').notNullable().unique()
      table.text('name').notNullable()
      table.specificType('source', 'source_type').notNullable()
      table
        .text('federative_level')
        .notNullable()
        .checkIn(['federal', 'state', 'municipal', 'multi_level'])
      table.string('state_code', 2).nullable()
      table.text('court_alias').nullable()
      table.text('branch').notNullable()
      table.text('priority').notNullable().checkIn(['primary', 'enrichment', 'cross_check'])
      table.text('adapter_key').nullable()
      table.text('source_url').nullable()
      table.text('source_format').nullable()
      table
        .text('status')
        .notNullable()
        .checkIn([
          'implemented',
          'generic_supported',
          'manual_review',
          'blocked_captcha',
          'unknown',
          'disabled',
        ])
        .defaultTo('unknown')
      table.text('cadence').notNullable().checkIn(['daily', 'weekly', 'monthly', 'manual'])
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('last_success_at', { useTz: true }).nullable()
      table.timestamp('last_error_at', { useTz: true }).nullable()
      table.text('last_error_message').nullable()
      table.integer('last_discovered_count').notNullable().defaultTo(0)
      table.integer('last_source_records_count').notNullable().defaultTo(0)
      table.decimal('coverage_score', 5, 4).notNullable().defaultTo(0)
      table.jsonb('metadata').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(['source_dataset_id'])
      table.index(['source', 'federative_level'])
      table.index(['court_alias'])
      table.index(['state_code'])
      table.index(['status', 'is_active'])
      table.index(['adapter_key'])
      table.index(['priority'])
    })

    this.defer(() => this.bootstrapTargets())
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }

  private async bootstrapTargets() {
    await this.ensureRequiredDatasets()

    const datasets = await this.db.from('source_datasets').select('id', 'key', 'base_url', 'format')
    const datasetByKey = new Map(datasets.map((dataset) => [dataset.key, dataset]))
    const targets = buildTargets()

    for (const target of targets) {
      const dataset = datasetByKey.get(target.sourceDatasetKey)
      if (!dataset) {
        throw new Error(`Source dataset ${target.sourceDatasetKey} is required.`)
      }

      await this.db
        .table(this.tableName)
        .insert({
          source_dataset_id: dataset.id,
          key: target.key,
          name: target.name,
          source: target.source,
          federative_level: target.federativeLevel,
          state_code: target.stateCode ?? null,
          court_alias: target.courtAlias ?? null,
          branch: target.branch,
          priority: target.priority,
          adapter_key: target.adapterKey ?? null,
          source_url: target.sourceUrl ?? dataset.base_url,
          source_format: target.sourceFormat ?? dataset.format,
          status: target.status,
          cadence: target.cadence,
          coverage_score: target.coverageScore,
          metadata: target.metadata ?? null,
        })
        .onConflict('key')
        .merge({
          source_dataset_id: dataset.id,
          name: target.name,
          source: target.source,
          federative_level: target.federativeLevel,
          state_code: target.stateCode ?? null,
          court_alias: target.courtAlias ?? null,
          branch: target.branch,
          priority: target.priority,
          adapter_key: target.adapterKey ?? null,
          source_url: target.sourceUrl ?? dataset.base_url,
          source_format: target.sourceFormat ?? dataset.format,
          status: target.status,
          cadence: target.cadence,
          coverage_score: target.coverageScore,
          metadata: target.metadata ?? null,
          updated_at: this.raw('now()'),
        })
    }
  }

  private async ensureRequiredDatasets() {
    await this.db
      .table('source_datasets')
      .insert({
        key: 'court-annual-map-pages',
        name: 'Court annual precatorio map publications',
        owner: 'State, federal, labor, electoral, military and superior courts',
        source: 'tribunal',
        federative_level: 'multi_level',
        kind: 'tribunal_publication',
        access: 'public',
        priority: 'primary',
        base_url: 'https://www.cnj.jus.br/sistema-de-gestao-de-precatorios/',
        format: 'html/pdf/xls/xlsx/csv',
        notes: 'Registry placeholder for per-court public maps, queues and transparency pages.',
        metadata: {
          levels: ['federal', 'state', 'municipal', 'multi_level'],
          coverage: 'per_court_discovery_registry',
        },
      })
      .onConflict('key')
      .merge({
        name: 'Court annual precatorio map publications',
        owner: 'State, federal, labor, electoral, military and superior courts',
        source: 'tribunal',
        federative_level: 'multi_level',
        kind: 'tribunal_publication',
        access: 'public',
        priority: 'primary',
        base_url: 'https://www.cnj.jus.br/sistema-de-gestao-de-precatorios/',
        format: 'html/pdf/xls/xlsx/csv',
        notes: 'Registry placeholder for per-court public maps, queues and transparency pages.',
        metadata: {
          levels: ['federal', 'state', 'municipal', 'multi_level'],
          coverage: 'per_court_discovery_registry',
        },
        updated_at: this.raw('now()'),
      })

    await this.db
      .table('source_datasets')
      .insert({
        key: 'trf4-chronological-precatorios',
        name: 'TRF4 ordem cronológica de precatórios',
        owner: 'Tribunal Regional Federal da 4ª Região',
        source: 'tribunal',
        federative_level: 'federal',
        kind: 'tribunal_publication',
        access: 'public',
        priority: 'primary',
        base_url:
          'https://www.trf4.jus.br/trf4/controlador.php?acao=consulta_precatorios_ordem_cronologica_externa',
        court_alias: 'trf4',
        format: 'csv',
        notes: 'TRF4 public chronological queues generated as CSV from the official public form.',
        metadata: {
          levels: ['federal'],
          coverage: 'chronological_queue',
          queueKinds: ['federal_budget', 'extra_budget_general', 'extra_budget_special'],
        },
      })
      .onConflict('key')
      .merge({
        name: 'TRF4 ordem cronológica de precatórios',
        owner: 'Tribunal Regional Federal da 4ª Região',
        source: 'tribunal',
        federative_level: 'federal',
        kind: 'tribunal_publication',
        access: 'public',
        priority: 'primary',
        base_url:
          'https://www.trf4.jus.br/trf4/controlador.php?acao=consulta_precatorios_ordem_cronologica_externa',
        court_alias: 'trf4',
        format: 'csv',
        notes: 'TRF4 public chronological queues generated as CSV from the official public form.',
        metadata: {
          levels: ['federal'],
          coverage: 'chronological_queue',
          queueKinds: ['federal_budget', 'extra_budget_general', 'extra_budget_special'],
        },
        updated_at: this.raw('now()'),
      })

    await this.db
      .table('source_datasets')
      .insert({
        key: 'trf5-precatorio-reports',
        name: 'TRF5 relatórios públicos de precatórios',
        owner: 'Tribunal Regional Federal da 5ª Região',
        source: 'tribunal',
        federative_level: 'federal',
        kind: 'tribunal_publication',
        access: 'public',
        priority: 'primary',
        base_url: 'https://rpvprecatorio.trf5.jus.br/mapa',
        court_alias: 'trf5',
        format: 'html/pdf',
        notes:
          'TRF5 public map page and PDF reports for paid precatorios, federal debt, and state/municipal chronological and special-regime queues.',
        metadata: {
          levels: ['federal', 'state', 'municipal'],
          coverage: 'pdf_reports',
          reportKinds: [
            'paid_precatorios',
            'federal_debt',
            'state_municipal_chronological_order',
            'state_municipal_special_regime_ec94',
            'state_municipal_special_regime_ec136',
          ],
        },
      })
      .onConflict('key')
      .merge({
        name: 'TRF5 relatórios públicos de precatórios',
        owner: 'Tribunal Regional Federal da 5ª Região',
        source: 'tribunal',
        federative_level: 'federal',
        kind: 'tribunal_publication',
        access: 'public',
        priority: 'primary',
        base_url: 'https://rpvprecatorio.trf5.jus.br/mapa',
        court_alias: 'trf5',
        format: 'html/pdf',
        notes:
          'TRF5 public map page and PDF reports for paid precatorios, federal debt, and state/municipal chronological and special-regime queues.',
        metadata: {
          levels: ['federal', 'state', 'municipal'],
          coverage: 'pdf_reports',
          reportKinds: [
            'paid_precatorios',
            'federal_debt',
            'state_municipal_chronological_order',
            'state_municipal_special_regime_ec94',
            'state_municipal_special_regime_ec136',
          ],
        },
        updated_at: this.raw('now()'),
      })

    await this.db
      .table('source_datasets')
      .insert({
        key: 'trf6-federal-precatorio-orders',
        name: 'TRF6 ordem cronológica de precatórios federais',
        owner: 'Tribunal Regional Federal da 6ª Região',
        source: 'tribunal',
        federative_level: 'federal',
        kind: 'tribunal_publication',
        access: 'public',
        priority: 'primary',
        base_url: 'https://portal.trf6.jus.br/rpv-e-precatorios/precatorios-federais/',
        court_alias: 'trf6',
        format: 'html/pdf',
        notes:
          'TRF6 public federal budget-order precatorio PDFs. The 2026 eproc endpoint currently requires CAPTCHA and is tracked as blocked metadata.',
        metadata: {
          levels: ['federal'],
          coverage: 'chronological_queue',
          reportKinds: ['federal_budget_order'],
          manualExportUrl:
            'https://eproc2g.trf6.jus.br/eproc/externo_controlador.php?acao=gerar_arquivo_precatorio&hash=7f9e1fbd97915e3bce36b6bd2528b0d3',
          blockedLinks: ['eproc_2026_captcha'],
        },
      })
      .onConflict('key')
      .merge({
        name: 'TRF6 ordem cronológica de precatórios federais',
        owner: 'Tribunal Regional Federal da 6ª Região',
        source: 'tribunal',
        federative_level: 'federal',
        kind: 'tribunal_publication',
        access: 'public',
        priority: 'primary',
        base_url: 'https://portal.trf6.jus.br/rpv-e-precatorios/precatorios-federais/',
        court_alias: 'trf6',
        format: 'html/pdf',
        notes:
          'TRF6 public federal budget-order precatorio PDFs. The 2026 eproc endpoint currently requires CAPTCHA and is tracked as blocked metadata.',
        metadata: {
          levels: ['federal'],
          coverage: 'chronological_queue',
          reportKinds: ['federal_budget_order'],
          manualExportUrl:
            'https://eproc2g.trf6.jus.br/eproc/externo_controlador.php?acao=gerar_arquivo_precatorio&hash=7f9e1fbd97915e3bce36b6bd2528b0d3',
          blockedLinks: ['eproc_2026_captcha'],
        },
        updated_at: this.raw('now()'),
      })
  }
}

function buildTargets(): TargetSeed[] {
  return [
    ...DATAJUD_COURTS.map((court) => ({
      key: `datajud:${court.alias}`,
      sourceDatasetKey: 'datajud-public-api',
      name: `DataJud ${court.alias.toUpperCase()} precatórios e RPVs`,
      source: 'datajud' as const,
      federativeLevel: court.federativeLevel,
      stateCode: court.stateCode,
      courtAlias: court.alias,
      branch: court.branch,
      priority: 'enrichment' as const,
      adapterKey: 'datajud_precatorio_discovery',
      sourceUrl: `https://api-publica.datajud.cnj.jus.br/api_publica_${court.alias}/_search`,
      sourceFormat: 'json',
      status: 'implemented' as const,
      cadence: 'daily' as const,
      coverageScore: '0.6500',
      metadata: {
        classCodes: [1265, 1266],
        purpose: 'process_metadata_and_movements',
      },
    })),
    ...DATAJUD_COURTS.map((court) => ({
      key: `djen:${court.alias}`,
      sourceDatasetKey: 'djen-public-communications',
      name: `DJEN ${court.alias.toUpperCase()} publicações de precatórios`,
      source: 'djen' as const,
      federativeLevel: court.federativeLevel,
      stateCode: court.stateCode,
      courtAlias: court.alias,
      branch: court.branch,
      priority: 'enrichment' as const,
      adapterKey: 'djen_publication_sync',
      sourceUrl: 'https://comunicaapi.pje.jus.br/api/v1/comunicacao',
      sourceFormat: 'json',
      status: 'generic_supported' as const,
      cadence: 'daily' as const,
      coverageScore: '0.5000',
      metadata: {
        searchTexts: ['precatório', 'RPV'],
        purpose: 'publication_events_and_liquidity_signals',
      },
    })),
    ...DATAJUD_COURTS.map((court) => ({
      key: `court-map:${court.alias}`,
      sourceDatasetKey: 'court-annual-map-pages',
      name: `Mapa/lista pública de precatórios ${court.alias.toUpperCase()}`,
      source: 'tribunal' as const,
      federativeLevel: court.federativeLevel,
      stateCode: court.stateCode,
      courtAlias: court.alias,
      branch: court.branch,
      priority: 'primary' as const,
      adapterKey: null,
      sourceUrl: null,
      sourceFormat: 'html/pdf/xls/xlsx/csv',
      status: 'unknown' as const,
      cadence: 'weekly' as const,
      coverageScore: '0.1000',
      metadata: {
        purpose: 'raw_state_and_municipal_precatorio_discovery',
        needsAdapter: true,
      },
    })),
    ...SPECIFIC_TRIBUNAL_TARGETS,
  ]
}
