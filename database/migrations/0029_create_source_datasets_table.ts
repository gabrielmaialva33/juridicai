import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'source_datasets'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.text('key').notNullable().unique()
      table.text('name').notNullable()
      table.text('owner').nullable()
      table.specificType('source', 'source_type').notNullable()
      table
        .text('federative_level')
        .notNullable()
        .checkIn(['federal', 'state', 'municipal', 'multi_level'])
      table
        .text('kind')
        .notNullable()
        .checkIn(['open_data_file', 'soap_webservice', 'public_search_api', 'tribunal_publication'])
      table.text('access').notNullable().checkIn(['public', 'credentialed', 'certificate'])
      table.text('priority').notNullable().checkIn(['primary', 'enrichment', 'cross_check'])
      table.text('base_url').notNullable()
      table.string('state_code', 2).nullable()
      table.text('court_alias').nullable()
      table.text('format').nullable()
      table.text('notes').nullable()
      table.jsonb('metadata').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(['source', 'federative_level'])
      table.index(['state_code'])
      table.index(['court_alias'])
      table.index(['priority'])
      table.index(['is_active'])
    })

    this.defer((db) =>
      db.rawQuery(`
        insert into source_datasets
          (key, name, owner, source, federative_level, kind, access, priority, base_url, court_alias, format, notes, metadata)
        values
          (
            'siop-open-data-precatorios',
            'SIOP Precatórios Dados Abertos',
            'Secretaria de Orçamento Federal / Ministério do Planejamento e Orçamento',
            'siop',
            'federal',
            'open_data_file',
            'public',
            'primary',
            'https://www.gov.br/planejamento/pt-br/assuntos/orcamento/precatorios-content/painel-precatorios/dados-abertos',
            null,
            'csv/xlsx',
            'Federal open dataset for precatorios and RPVs from SIOP.',
            '{"levels":["federal"],"coverage":"federal_budget"}'::jsonb
          ),
          (
            'datajud-public-api',
            'CNJ DataJud Public API',
            'Conselho Nacional de Justiça',
            'datajud',
            'multi_level',
            'public_search_api',
            'public',
            'enrichment',
            'https://api-publica.datajud.cnj.jus.br',
            null,
            'json',
            'Process metadata, subjects and movements across court aliases.',
            '{"levels":["federal","state","municipal","multi_level"],"coverage":"process_metadata"}'::jsonb
          ),
          (
            'djen-public-communications',
            'DJEN Comunicações Processuais API Pública',
            'Conselho Nacional de Justiça',
            'djen',
            'multi_level',
            'tribunal_publication',
            'public',
            'enrichment',
            'https://comunicaapi.pje.jus.br/api/v1/comunicacao',
            null,
            'json',
            'Official public API for Diário de Justiça Eletrônico Nacional communications and edital publications.',
            '{"levels":["federal","state","municipal","multi_level"],"coverage":"procedural_publications"}'::jsonb
          ),
          (
            'tjsp-precatorio-communications',
            'TJSP Comunicados de Precatórios',
            'Tribunal de Justiça do Estado de São Paulo',
            'tribunal',
            'state',
            'tribunal_publication',
            'public',
            'primary',
            'https://www.tjsp.jus.br/Precatorios/Precatorios/ListaGeral',
            'tjsp',
            'html/pdf/xls/xlsx',
            'TJSP public communication pages for state, municipal and INSS precatorio lists.',
            '{"levels":["state","municipal"],"coverage":"precatorio_communications","state_code":"SP","categories":["state_entities","municipal_entities","inss","statistics"]}'::jsonb
          ),
          (
            'trf2-chronological-precatorios',
            'TRF2 ordem cronológica de precatórios',
            'Tribunal Regional Federal da 2ª Região',
            'tribunal',
            'federal',
            'tribunal_publication',
            'public',
            'enrichment',
            'https://www10.trf2.jus.br/precatorios/consultas/',
            'trf2',
            'csv',
            'TRF2 chronological queue and payment-status files.',
            '{"levels":["federal"],"coverage":"chronological_queue"}'::jsonb
          ),
          (
            'trf4-chronological-precatorios',
            'TRF4 ordem cronológica de precatórios',
            'Tribunal Regional Federal da 4ª Região',
            'tribunal',
            'federal',
            'tribunal_publication',
            'public',
            'primary',
            'https://www.trf4.jus.br/trf4/controlador.php?acao=consulta_precatorios_ordem_cronologica_externa',
            'trf4',
            'csv',
            'TRF4 public chronological queues generated as CSV from the official public form.',
            '{"levels":["federal"],"coverage":"chronological_queue","queueKinds":["federal_budget","extra_budget_general","extra_budget_special"]}'::jsonb
          ),
          (
            'trf5-precatorio-reports',
            'TRF5 relatórios públicos de precatórios',
            'Tribunal Regional Federal da 5ª Região',
            'tribunal',
            'federal',
            'tribunal_publication',
            'public',
            'primary',
            'https://rpvprecatorio.trf5.jus.br/mapa',
            'trf5',
            'html/pdf',
            'TRF5 public map page and PDF reports for paid precatorios, federal debt, and state/municipal chronological and special-regime queues.',
            '{"levels":["federal","state","municipal"],"coverage":"pdf_reports","reportKinds":["paid_precatorios","federal_debt","state_municipal_chronological_order","state_municipal_special_regime_ec94","state_municipal_special_regime_ec136"]}'::jsonb
          ),
          (
            'cnj-annual-precatorios-map',
            'CNJ Mapa Anual dos Precatórios',
            'Conselho Nacional de Justiça',
            'tribunal',
            'multi_level',
            'tribunal_publication',
            'public',
            'cross_check',
            'https://www.cnj.jus.br/sistema-de-gestao-de-precatorios/',
            null,
            'html/pdf/xls',
            'National annual consolidation for coverage validation.',
            '{"levels":["federal","state","municipal","multi_level"],"coverage":"aggregate_validation"}'::jsonb
          ),
          (
            'court-annual-map-pages',
            'Court annual precatorio map publications',
            'State, federal, labor, electoral, military and superior courts',
            'tribunal',
            'multi_level',
            'tribunal_publication',
            'public',
            'primary',
            'https://www.cnj.jus.br/sistema-de-gestao-de-precatorios/',
            null,
            'html/pdf/xls/xlsx/csv',
            'Registry placeholder for per-court public maps, queues and transparency pages.',
            '{"levels":["federal","state","municipal","multi_level"],"coverage":"per_court_discovery_registry"}'::jsonb
          )
        on conflict (key) do update set
          name = excluded.name,
          owner = excluded.owner,
          source = excluded.source,
          federative_level = excluded.federative_level,
          kind = excluded.kind,
          access = excluded.access,
          priority = excluded.priority,
          base_url = excluded.base_url,
          court_alias = excluded.court_alias,
          format = excluded.format,
          notes = excluded.notes,
          metadata = excluded.metadata,
          updated_at = current_timestamp;
      `)
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
