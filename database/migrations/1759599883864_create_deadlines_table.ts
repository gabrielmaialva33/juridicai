import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'deadlines'

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
      table
        .bigInteger('responsible_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')

      table.string('title', 255).notNullable().comment('Título do prazo')
      table.text('description').nullable().comment('Descrição detalhada')

      // Datas
      table.date('deadline_date').notNullable().comment('Data limite do prazo')
      table.date('internal_deadline_date').nullable().comment('Data interna com margem de segurança')

      // Classificação
      table.boolean('is_fatal').notNullable().defaultTo(false).comment('Prazo fatal (não pode perder)')
      table
        .enum('status', ['pending', 'completed', 'expired', 'cancelled'])
        .notNullable()
        .defaultTo('pending')

      // Alertas
      table.jsonb('alert_config').nullable().comment('Configuração de alertas')
      table.timestamp('last_alert_sent_at').nullable()

      // Conclusão
      table.timestamp('completed_at').nullable()
      table.bigInteger('completed_by').unsigned().nullable().references('id').inTable('users')
      table.text('completion_notes').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    // Indexes
    this.schema.raw('CREATE INDEX idx_deadlines_tenant_id ON deadlines(tenant_id)')
    this.schema.raw('CREATE INDEX idx_deadlines_case_id ON deadlines(tenant_id, case_id)')
    this.schema.raw('CREATE INDEX idx_deadlines_responsible ON deadlines(tenant_id, responsible_id)')
    this.schema.raw('CREATE INDEX idx_deadlines_status ON deadlines(tenant_id, status)')
    this.schema.raw('CREATE INDEX idx_deadlines_date ON deadlines(tenant_id, deadline_date)')
    this.schema.raw('CREATE INDEX idx_deadlines_is_fatal ON deadlines(tenant_id, is_fatal, deadline_date)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
