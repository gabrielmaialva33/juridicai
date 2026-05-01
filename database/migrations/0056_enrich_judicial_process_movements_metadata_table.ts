import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'judicial_process_movements'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('judging_body_code').nullable()
      table.text('judging_body_name').nullable()
      table.integer('judging_body_municipality_ibge_code').nullable()

      table.index(['tenant_id', 'judging_body_municipality_ibge_code'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['tenant_id', 'judging_body_municipality_ibge_code'])
      table.dropColumn('judging_body_code')
      table.dropColumn('judging_body_name')
      table.dropColumn('judging_body_municipality_ibge_code')
    })
  }
}
