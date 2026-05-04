import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'asset_field_evidences'

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
      table.text('field_key').notNullable()
      table.text('canonical_value').nullable()
      table.specificType('canonical_source', 'source_type').nullable()
      table
        .uuid('canonical_source_record_id')
        .nullable()
        .references('id')
        .inTable('source_records')
        .onDelete('SET NULL')
      table
        .uuid('canonical_source_dataset_id')
        .nullable()
        .references('id')
        .inTable('source_datasets')
        .onDelete('SET NULL')
      table.decimal('confidence', 5, 4).notNullable().defaultTo(0)
      table
        .text('status')
        .notNullable()
        .checkIn(['resolved', 'conflict', 'missing'])
        .defaultTo('missing')
      table.integer('evidence_count').notNullable().defaultTo(0)
      table.jsonb('conflicting_values').notNullable().defaultTo(this.raw(`'[]'::jsonb`))
      table.jsonb('evidence').notNullable().defaultTo(this.raw(`'[]'::jsonb`))
      table.timestamp('computed_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['tenant_id', 'asset_id', 'field_key'])
      table.index(['tenant_id', 'asset_id'])
      table.index(['tenant_id', 'field_key', 'status'])
      table.index(['tenant_id', 'canonical_source'])
      table.index(['tenant_id', 'computed_at'])
    })

    this.defer((db) =>
      db.rawQuery(`
        alter table asset_field_evidences
        add constraint asset_field_evidences_asset_same_tenant_fk
        foreign key (tenant_id, asset_id)
        references precatorio_assets (tenant_id, id)
        on delete cascade;

        alter table asset_field_evidences
        add constraint asset_field_evidences_source_record_same_tenant_fk
        foreign key (tenant_id, canonical_source_record_id)
        references source_records (tenant_id, id)
        on delete set null (canonical_source_record_id);
      `)
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
