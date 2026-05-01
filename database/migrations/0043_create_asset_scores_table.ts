import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'asset_scores'

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
      table.text('score_version').notNullable()
      table.smallint('data_quality_score').nullable()
      table.smallint('maturity_score').nullable()
      table.smallint('liquidity_score').nullable()
      table.smallint('legal_signal_score').nullable()
      table.smallint('economic_score').nullable()
      table.smallint('risk_score').nullable()
      table.smallint('final_score').nullable()
      table.jsonb('explanation').nullable()
      table.timestamp('computed_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(['tenant_id', 'asset_id', 'computed_at'])
    })

    this.defer((db) =>
      db.rawQuery(`
        alter table asset_scores
        add constraint asset_scores_asset_same_tenant_fk
        foreign key (tenant_id, asset_id)
        references precatorio_assets (tenant_id, id)
        on delete cascade;

        alter table precatorio_assets
        add constraint precatorio_assets_current_score_id_foreign
        foreign key (current_score_id)
        references asset_scores (id)
        on delete set null
      `)
    )
  }

  async down() {
    this.defer((db) =>
      db.rawQuery(`
        alter table if exists precatorio_assets
        drop constraint if exists precatorio_assets_current_score_id_foreign
      `)
    )
    this.schema.dropTable(this.tableName)
  }
}
