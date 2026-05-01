import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'judicial_processes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table
        .uuid('asset_id')
        .nullable()
        .references('id')
        .inTable('precatorio_assets')
        .onDelete('SET NULL')
      table
        .uuid('source_record_id')
        .nullable()
        .references('id')
        .inTable('source_records')
        .onDelete('SET NULL')
      table.specificType('source', 'source_type').notNullable()
      table.text('cnj_number').notNullable()
      table.text('datajud_id').nullable()
      table.text('datajud_index').nullable()
      table.uuid('court_id').nullable().references('id').inTable('courts').onDelete('SET NULL')
      table
        .uuid('system_id')
        .nullable()
        .references('id')
        .inTable('judicial_systems')
        .onDelete('SET NULL')
      table
        .uuid('format_id')
        .nullable()
        .references('id')
        .inTable('process_formats')
        .onDelete('SET NULL')
      table
        .uuid('class_id')
        .nullable()
        .references('id')
        .inTable('judicial_classes')
        .onDelete('SET NULL')
      table
        .uuid('judging_body_id')
        .nullable()
        .references('id')
        .inTable('judging_bodies')
        .onDelete('SET NULL')
      table.text('court_alias').nullable()
      table.text('degree').nullable()
      table.integer('secrecy_level').nullable()
      table.date('filed_at').nullable()
      table.timestamp('datajud_updated_at', { useTz: true }).nullable()
      table.timestamp('datajud_indexed_at', { useTz: true }).nullable()
      table.jsonb('raw_data').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('deleted_at', { useTz: true }).nullable()

      table.unique(['tenant_id', 'cnj_number'])
      table.index(['tenant_id', 'asset_id'])
      table.index(['tenant_id', 'court_id'])
      table.index(['tenant_id', 'class_id'])
      table.index(['tenant_id', 'judging_body_id'])
      table.index(['tenant_id', 'court_alias'])
      table.index(['tenant_id', 'degree'])
    })

    this.defer((db) =>
      db.rawQuery(`
        alter table judicial_processes
        add constraint judicial_processes_tenant_id_id_uq
        unique (tenant_id, id);

        alter table judicial_processes
        add constraint judicial_processes_asset_same_tenant_fk
        foreign key (tenant_id, asset_id)
        references precatorio_assets (tenant_id, id)
        on delete set null (asset_id);
      `)
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
