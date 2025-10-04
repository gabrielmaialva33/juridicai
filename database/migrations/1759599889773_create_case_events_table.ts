import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'case_events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()

      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table
        .bigInteger('case_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('cases')
        .onDelete('CASCADE')

      // Tipo de evento
      table
        .enum('event_type', [
          'filing',
          'hearing',
          'decision',
          'publication',
          'appeal',
          'motion',
          'settlement',
          'judgment',
          'other',
        ])
        .notNullable()

      table.string('title', 255).notNullable()
      table.text('description').nullable()

      // Data e origem
      table.timestamp('event_date').notNullable().comment('Data do evento')
      table
        .enum('source', ['manual', 'court_api', 'email', 'import'])
        .notNullable()
        .defaultTo('manual')

      // Dados adicionais
      table.jsonb('metadata').nullable().comment('Dados extras do evento')
      table.bigInteger('created_by').unsigned().nullable().references('id').inTable('users')

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    // Indexes
    this.schema.raw('CREATE INDEX idx_case_events_tenant_id ON case_events(tenant_id)')
    this.schema.raw('CREATE INDEX idx_case_events_case_id ON case_events(tenant_id, case_id)')
    this.schema.raw('CREATE INDEX idx_case_events_type ON case_events(tenant_id, event_type)')
    this.schema.raw('CREATE INDEX idx_case_events_date ON case_events(tenant_id, event_date DESC)')
    this.schema.raw('CREATE INDEX idx_case_events_source ON case_events(tenant_id, source)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
