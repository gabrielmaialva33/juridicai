import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'process_match_candidates'

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
      table
        .uuid('source_record_id')
        .nullable()
        .references('id')
        .inTable('source_records')
        .onDelete('SET NULL')
      table.specificType('source', 'source_type').notNullable()
      table.text('court_alias').notNullable()
      table.text('candidate_cnj').notNullable()
      table.text('candidate_datajud_id').notNullable()
      table.text('candidate_index').notNullable()
      table.smallint('score').notNullable()
      table.text('status').notNullable().defaultTo('candidate')
      table.jsonb('signals').notNullable()
      table.jsonb('raw_data').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(['tenant_id', 'asset_id', 'status'])
      table.index(['tenant_id', 'candidate_cnj'])
      table.unique(['tenant_id', 'asset_id', 'candidate_cnj', 'candidate_datajud_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
