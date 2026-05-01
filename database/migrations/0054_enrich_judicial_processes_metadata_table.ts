import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'judicial_processes'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('datajud_id').nullable()
      table.text('datajud_index').nullable()
      table.text('court_alias').nullable()
      table.text('degree').nullable()
      table.integer('secrecy_level').nullable()
      table.integer('system_code').nullable()
      table.text('system_name').nullable()
      table.integer('format_code').nullable()
      table.text('format_name').nullable()
      table.integer('class_code').nullable()
      table.text('judging_body_code').nullable()
      table.text('judging_body_name').nullable()
      table.integer('judging_body_municipality_ibge_code').nullable()
      table.timestamp('datajud_updated_at', { useTz: true }).nullable()
      table.timestamp('datajud_indexed_at', { useTz: true }).nullable()

      table.index(['tenant_id', 'court_alias'])
      table.index(['tenant_id', 'class_code'])
      table.index(['tenant_id', 'degree'])
      table.index(['tenant_id', 'judging_body_municipality_ibge_code'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['tenant_id', 'judging_body_municipality_ibge_code'])
      table.dropIndex(['tenant_id', 'degree'])
      table.dropIndex(['tenant_id', 'class_code'])
      table.dropIndex(['tenant_id', 'court_alias'])

      table.dropColumn('datajud_id')
      table.dropColumn('datajud_index')
      table.dropColumn('court_alias')
      table.dropColumn('degree')
      table.dropColumn('secrecy_level')
      table.dropColumn('system_code')
      table.dropColumn('system_name')
      table.dropColumn('format_code')
      table.dropColumn('format_name')
      table.dropColumn('class_code')
      table.dropColumn('judging_body_code')
      table.dropColumn('judging_body_name')
      table.dropColumn('judging_body_municipality_ibge_code')
      table.dropColumn('datajud_updated_at')
      table.dropColumn('datajud_indexed_at')
    })
  }
}
