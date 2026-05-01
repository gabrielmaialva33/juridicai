import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'judicial_process_subjects'

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
      table.integer('subject_code').nullable()
      table.text('subject_name').notNullable()
      table.integer('sequence').nullable()
      table.jsonb('raw_data').nullable()
      table.text('idempotency_key').notNullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['tenant_id', 'idempotency_key'])
      table.index(['tenant_id', 'process_id'])
      table.index(['tenant_id', 'subject_code'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
