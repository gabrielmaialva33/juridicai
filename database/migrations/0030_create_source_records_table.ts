import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'source_records'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table
        .uuid('source_dataset_id')
        .nullable()
        .references('id')
        .inTable('source_datasets')
        .onDelete('SET NULL')
      table.specificType('source', 'source_type').notNullable()
      table.text('source_url').nullable()
      table.text('source_file_path').nullable()
      table.text('source_checksum').nullable()
      table.text('original_filename').nullable()
      table.text('mime_type').nullable()
      table.bigInteger('file_size_bytes').nullable()
      table.timestamp('collected_at', { useTz: true }).notNullable()
      table.jsonb('raw_data').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(['tenant_id', 'source', 'collected_at'])
      table.index(['tenant_id', 'source_dataset_id'])
    })

    this.defer((db) =>
      db.rawQuery(`
        create unique index source_records_tenant_source_checksum_uq
        on source_records (tenant_id, source, source_checksum)
        where source_checksum is not null;

        alter table source_records
        add constraint source_records_tenant_id_id_uq
        unique (tenant_id, id);
      `)
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
