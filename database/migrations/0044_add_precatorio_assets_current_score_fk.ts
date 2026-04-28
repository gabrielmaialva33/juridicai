import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('precatorio_assets', (table) => {
      table
        .foreign('current_score_id')
        .references('id')
        .inTable('asset_scores')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable('precatorio_assets', (table) => {
      table.dropForeign(['current_score_id'])
    })
  }
}
