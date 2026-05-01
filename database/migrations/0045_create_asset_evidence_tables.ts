import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('asset_source_links', (table) => {
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
        .notNullable()
        .references('id')
        .inTable('source_records')
        .onDelete('CASCADE')
      table
        .uuid('source_dataset_id')
        .nullable()
        .references('id')
        .inTable('source_datasets')
        .onDelete('SET NULL')
      table
        .text('link_type')
        .notNullable()
        .defaultTo('primary')
        .checkIn(['primary', 'enrichment', 'cross_check', 'conflict', 'manual'])
      table.decimal('confidence', 5, 4).notNullable().defaultTo(1)
      table.text('match_reason').nullable()
      table.jsonb('matched_fields').nullable()
      table.jsonb('normalized_payload').nullable()
      table.jsonb('raw_pointer').nullable()
      table.timestamp('first_seen_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('last_seen_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['tenant_id', 'asset_id', 'source_record_id'])
      table.index(['tenant_id', 'asset_id'])
      table.index(['tenant_id', 'source_record_id'])
      table.index(['tenant_id', 'source_dataset_id'])
      table.index(['tenant_id', 'link_type'])
    })

    this.schema.createTable('external_identifiers', (table) => {
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
      table
        .uuid('source_dataset_id')
        .nullable()
        .references('id')
        .inTable('source_datasets')
        .onDelete('SET NULL')
      table
        .text('identifier_type')
        .notNullable()
        .checkIn([
          'cnj_number',
          'precatorio_number',
          'requisition_number',
          'origin_process_number',
          'asset_number',
          'chronological_order',
          'source_external_id',
          'datajud_id',
          'payment_queue_id',
        ])
      table.text('identifier_value').notNullable()
      table.text('normalized_value').notNullable()
      table.text('issuer').nullable()
      table.decimal('confidence', 5, 4).notNullable().defaultTo(1)
      table.boolean('is_primary').notNullable().defaultTo(false)
      table.jsonb('raw_data').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['tenant_id', 'asset_id', 'identifier_type', 'normalized_value'])
      table.index(['tenant_id', 'identifier_type', 'normalized_value'])
      table.index(['tenant_id', 'source_record_id'])
      table.index(['tenant_id', 'source_dataset_id'])
    })

    this.defer((db) =>
      db.rawQuery(`
        alter table asset_source_links
        add constraint asset_source_links_asset_same_tenant_fk
        foreign key (tenant_id, asset_id)
        references precatorio_assets (tenant_id, id)
        on delete cascade;

        alter table asset_source_links
        add constraint asset_source_links_source_record_same_tenant_fk
        foreign key (tenant_id, source_record_id)
        references source_records (tenant_id, id)
        on delete cascade;

        alter table external_identifiers
        add constraint external_identifiers_asset_same_tenant_fk
        foreign key (tenant_id, asset_id)
        references precatorio_assets (tenant_id, id)
        on delete cascade;

        alter table external_identifiers
        add constraint external_identifiers_source_record_same_tenant_fk
        foreign key (tenant_id, source_record_id)
        references source_records (tenant_id, id)
        on delete set null (source_record_id);
      `)
    )
  }

  async down() {
    this.schema.dropTable('external_identifiers')
    this.schema.dropTable('asset_source_links')
  }
}
