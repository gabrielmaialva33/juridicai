import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'judicial_process_signals'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table
        .uuid('process_id')
        .notNullable()
        .references('id')
        .inTable('judicial_processes')
        .onDelete('CASCADE')
      table
        .uuid('movement_id')
        .nullable()
        .references('id')
        .inTable('judicial_process_movements')
        .onDelete('SET NULL')
      table.text('signal_code').notNullable()
      table.text('polarity').notNullable()
      table.smallint('confidence').notNullable()
      table.timestamp('detected_at', { useTz: true }).notNullable()
      table.specificType('source', 'source_type').notNullable().defaultTo('datajud')
      table.jsonb('evidence').nullable()
      table.text('idempotency_key').notNullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['tenant_id', 'idempotency_key'])
      table.index(['tenant_id', 'process_id'])
      table.index(['tenant_id', 'movement_id'])
      table.index(['tenant_id', 'signal_code'])
      table.index(['tenant_id', 'polarity'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
