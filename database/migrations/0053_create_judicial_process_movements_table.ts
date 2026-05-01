import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'judicial_process_movements'

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
        .uuid('source_record_id')
        .nullable()
        .references('id')
        .inTable('source_records')
        .onDelete('SET NULL')
      table.specificType('source', 'source_type').notNullable().defaultTo('datajud')
      table.integer('movement_code').nullable()
      table.text('movement_name').notNullable()
      table.timestamp('occurred_at', { useTz: true }).nullable()
      table.integer('sequence').nullable()
      table.jsonb('raw_data').nullable()
      table.text('idempotency_key').notNullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['tenant_id', 'idempotency_key'])
      table.index(['tenant_id', 'process_id', 'occurred_at'])
      table.index(['tenant_id', 'movement_code'])
      table.index(['process_id', 'sequence'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
