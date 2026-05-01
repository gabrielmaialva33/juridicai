import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'precatorio_assets'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table
        .uuid('source_record_id')
        .nullable()
        .references('id')
        .inTable('source_records')
        .onDelete('SET NULL')
      table.specificType('source', 'source_type').notNullable()
      table.text('external_id').nullable()
      table.text('cnj_number').nullable()
      table.text('origin_process_number').nullable()
      table.uuid('debtor_id').nullable().references('id').inTable('debtors').onDelete('SET NULL')
      table.uuid('court_id').nullable().references('id').inTable('courts').onDelete('SET NULL')
      table
        .uuid('budget_unit_id')
        .nullable()
        .references('id')
        .inTable('budget_units')
        .onDelete('SET NULL')
      table.text('asset_number').nullable()
      table.integer('exercise_year').nullable()
      table.integer('budget_year').nullable()
      table.specificType('nature', 'asset_nature').notNullable().defaultTo('unknown')
      table.date('origin_filed_at').nullable()
      table.date('autuated_at').nullable()
      table.specificType('lifecycle_status', 'lifecycle_status').notNullable().defaultTo('unknown')
      table.specificType('pii_status', 'pii_status').notNullable().defaultTo('none')
      table
        .specificType('compliance_status', 'compliance_status')
        .notNullable()
        .defaultTo('pending')
      table.smallint('current_score').nullable()
      table.uuid('current_score_id').nullable()
      table.jsonb('raw_data').nullable()
      table.text('row_fingerprint').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('deleted_at', { useTz: true }).nullable()

      table.index(['tenant_id', 'exercise_year'])
      table.index(['tenant_id', 'debtor_id'])
      table.index(['tenant_id', 'court_id'])
      table.index(['tenant_id', 'budget_unit_id'])
      table.index(['tenant_id', 'lifecycle_status'])
      table.index(['tenant_id', 'compliance_status'])
      table.index(['tenant_id', 'origin_filed_at'])
      table.index(['tenant_id', 'autuated_at'])
    })

    this.defer((db) =>
      db.rawQuery(`
        create unique index precatorio_assets_tenant_source_external_uq
        on precatorio_assets (tenant_id, source, external_id)
        where external_id is not null;

        create unique index precatorio_assets_tenant_cnj_uq
        on precatorio_assets (tenant_id, cnj_number)
        where cnj_number is not null;

        alter table precatorio_assets
        add constraint precatorio_assets_tenant_id_id_uq
        unique (tenant_id, id);
      `)
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
