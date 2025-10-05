import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'cases'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()

      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table
        .bigInteger('client_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('clients')
        .onDelete('RESTRICT')

      // Identificação do processo
      table.string('case_number', 50).nullable().comment('Número CNJ do processo')
      table.string('internal_number', 50).nullable().comment('Número interno do escritório')

      // Tipo e classificação
      table
        .enum('case_type', [
          'civil',
          'criminal',
          'labor',
          'family',
          'tax',
          'administrative',
          'other',
        ])
        .notNullable()
        .defaultTo('civil')
      table.string('court', 100).nullable().comment('Tribunal (TJ-SP, TRT-2, etc)')
      table.string('court_instance', 50).nullable().comment('Instância (1ª, 2ª, STF, etc)')

      // Status e situação
      table
        .enum('status', ['active', 'closed', 'archived', 'suspended'])
        .notNullable()
        .defaultTo('active')
      table.enum('priority', ['low', 'medium', 'high', 'urgent']).notNullable().defaultTo('medium')

      // Responsáveis
      table
        .bigInteger('responsible_lawyer_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      table
        .specificType('team_members', 'bigint[]')
        .nullable()
        .comment('Array de user_ids da equipe')

      // Datas importantes
      table.date('filed_at').nullable().comment('Data de distribuição/ajuizamento')
      table.date('closed_at').nullable().comment('Data de encerramento')

      // Organização
      table.specificType('tags', 'text[]').nullable().comment('Tags para categorização')
      table.text('description').nullable().comment('Descrição do caso')
      table.jsonb('custom_fields').nullable().comment('Campos customizados')

      // Partes processuais (armazenadas como JSON)
      table.jsonb('parties').nullable().comment('Partes do processo (autor, réu, etc)')

      // Valor da causa
      table.decimal('case_value', 15, 2).nullable().comment('Valor da causa')

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      // Constraints
      table.unique(['tenant_id', 'case_number'])
      table.unique(['tenant_id', 'internal_number'])
    })

    // Indexes
    this.schema.raw('CREATE INDEX idx_cases_tenant_id ON cases(tenant_id)')
    this.schema.raw('CREATE INDEX idx_cases_client_id ON cases(tenant_id, client_id)')
    this.schema.raw('CREATE INDEX idx_cases_status ON cases(tenant_id, status)')
    this.schema.raw('CREATE INDEX idx_cases_responsible ON cases(tenant_id, responsible_lawyer_id)')
    this.schema.raw('CREATE INDEX idx_cases_priority ON cases(tenant_id, priority)')
    this.schema.raw('CREATE INDEX idx_cases_case_type ON cases(tenant_id, case_type)')
    this.schema.raw('CREATE INDEX idx_cases_filed_at ON cases(tenant_id, filed_at)')

    // Full-text search
    this.schema.raw(`
      CREATE INDEX idx_cases_search
        ON cases
          USING GIN (to_tsvector('portuguese',
                                 COALESCE(case_number, '') || ' ' ||
                                 COALESCE(internal_number, '') || ' ' ||
                                 COALESCE(description, '')
                     ))
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
