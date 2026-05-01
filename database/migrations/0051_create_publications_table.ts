import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'publications'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table
        .uuid('asset_id')
        .nullable()
        .references('id')
        .inTable('precatorio_assets')
        .onDelete('CASCADE')
      table
        .uuid('process_id')
        .nullable()
        .references('id')
        .inTable('judicial_processes')
        .onDelete('CASCADE')
      table
        .uuid('source_record_id')
        .nullable()
        .references('id')
        .inTable('source_records')
        .onDelete('SET NULL')
      table.specificType('source', 'source_type').notNullable()
      table.date('publication_date').notNullable()
      table.text('title').nullable()
      table.text('body').notNullable()
      table.text('text_hash').nullable()
      table.jsonb('raw_data').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(['tenant_id', 'asset_id', 'publication_date'])
      table.index(['tenant_id', 'process_id', 'publication_date'])
    })

    this.defer((db) =>
      db.rawQuery(`
        alter table publications
        add constraint publications_tenant_id_id_uq
        unique (tenant_id, id);

        alter table publications
        add constraint publications_asset_same_tenant_fk
        foreign key (tenant_id, asset_id)
        references precatorio_assets (tenant_id, id)
        on delete cascade;

        alter table publications
        add constraint publications_process_same_tenant_fk
        foreign key (tenant_id, process_id)
        references judicial_processes (tenant_id, id)
        on delete cascade;

        create unique index publications_tenant_source_hash_date_uq
        on publications (tenant_id, source, text_hash, publication_date)
        where text_hash is not null;
      `)
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
