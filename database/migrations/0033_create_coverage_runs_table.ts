import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'coverage_runs'

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
      table
        .uuid('source_record_id')
        .nullable()
        .references('id')
        .inTable('source_records')
        .onDelete('SET NULL')
      table.specificType('status', 'job_run_status').notNullable().defaultTo('pending')
      table.specificType('origin', 'job_run_origin').notNullable().defaultTo('scheduler')
      table.jsonb('scope').nullable()
      table.timestamp('started_at', { useTz: true }).nullable()
      table.timestamp('finished_at', { useTz: true }).nullable()
      table.integer('discovered_count').notNullable().defaultTo(0)
      table.integer('source_records_count').notNullable().defaultTo(0)
      table.integer('created_assets_count').notNullable().defaultTo(0)
      table.integer('linked_assets_count').notNullable().defaultTo(0)
      table.integer('enriched_assets_count').notNullable().defaultTo(0)
      table.integer('error_count').notNullable().defaultTo(0)
      table.jsonb('metrics').nullable()
      table.text('error_message').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(['tenant_id', 'source_dataset_id', 'status'])
      table.index(['tenant_id', 'status', 'started_at'])
      table.index(['tenant_id', 'source_record_id'])
    })

    this.defer((db) =>
      db.rawQuery(`
        alter table coverage_runs
        add constraint coverage_runs_source_record_same_tenant_fk
        foreign key (tenant_id, source_record_id)
        references source_records (tenant_id, id)
        on delete set null (source_record_id);
      `)
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
