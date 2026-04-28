import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'siop_imports'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table.integer('exercise_year').notNullable()
      table
        .uuid('source_record_id')
        .notNullable()
        .references('id')
        .inTable('source_records')
        .onDelete('RESTRICT')
      table.specificType('source', 'source_type').notNullable().defaultTo('siop')
      table.specificType('status', 'import_status').notNullable().defaultTo('pending')
      table.timestamp('started_at', { useTz: true }).nullable()
      table.timestamp('finished_at', { useTz: true }).nullable()
      table.integer('total_rows').notNullable().defaultTo(0)
      table.integer('inserted').notNullable().defaultTo(0)
      table.integer('updated').notNullable().defaultTo(0)
      table.integer('skipped').notNullable().defaultTo(0)
      table.integer('errors').notNullable().defaultTo(0)
      table.jsonb('raw_metadata').nullable()
      table
        .uuid('uploaded_by_user_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('deleted_at', { useTz: true }).nullable()

      table.unique(['tenant_id', 'source', 'exercise_year', 'source_record_id'])
      table.index(['tenant_id', 'status', 'exercise_year'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
