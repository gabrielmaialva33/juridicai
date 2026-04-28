import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'asset_events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table
        .uuid('asset_id')
        .notNullable()
        .references('id')
        .inTable('precatorio_assets')
        .onDelete('CASCADE')
      table.text('event_type').notNullable()
      table.timestamp('event_date', { useTz: true }).notNullable().defaultTo(this.now())
      table.specificType('source', 'source_type').nullable()
      table.jsonb('payload').nullable()
      table.text('idempotency_key').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['tenant_id', 'asset_id', 'event_type', 'idempotency_key'])
      table.index(['tenant_id', 'asset_id', 'event_date'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
