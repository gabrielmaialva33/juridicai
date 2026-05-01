import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'judicial_process_movement_complements'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table
        .uuid('movement_id')
        .notNullable()
        .references('id')
        .inTable('judicial_process_movements')
        .onDelete('CASCADE')
      table
        .uuid('source_record_id')
        .nullable()
        .references('id')
        .inTable('source_records')
        .onDelete('SET NULL')
      table.integer('complement_code').nullable()
      table.integer('complement_value').nullable()
      table.text('complement_name').nullable()
      table.text('complement_description').nullable()
      table.integer('sequence').nullable()
      table.jsonb('raw_data').nullable()
      table.text('idempotency_key').notNullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['tenant_id', 'idempotency_key'])
      table.index(['tenant_id', 'movement_id'])
      table.index(['tenant_id', 'complement_description'])
      table.index(['tenant_id', 'complement_code', 'complement_value'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
