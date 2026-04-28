import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'judicial_processes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table
        .uuid('asset_id')
        .nullable()
        .references('id')
        .inTable('precatorio_assets')
        .onDelete('SET NULL')
      table
        .uuid('source_record_id')
        .nullable()
        .references('id')
        .inTable('source_records')
        .onDelete('SET NULL')
      table.specificType('source', 'source_type').notNullable()
      table.text('cnj_number').notNullable()
      table.text('court_code').nullable()
      table.text('court_name').nullable()
      table.text('class_name').nullable()
      table.text('subject').nullable()
      table.date('filed_at').nullable()
      table.jsonb('raw_data').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('deleted_at', { useTz: true }).nullable()

      table.unique(['tenant_id', 'cnj_number'])
      table.index(['tenant_id', 'asset_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
