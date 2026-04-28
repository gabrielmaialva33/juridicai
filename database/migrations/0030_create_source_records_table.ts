import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'source_records'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
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
    })

    this.defer((db) =>
      db.rawQuery(`
        create unique index source_records_tenant_source_checksum_uq
        on source_records (tenant_id, source, source_checksum)
        where source_checksum is not null;
      `)
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
