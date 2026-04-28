import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'siop_staging_rows'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('import_id')
        .notNullable()
        .references('id')
        .inTable('siop_imports')
        .onDelete('CASCADE')
      table.jsonb('raw_data').notNullable()
      table.text('normalized_cnj').nullable()
      table.text('normalized_debtor_key').nullable()
      table.decimal('normalized_value', 18, 2).nullable()
      table.integer('normalized_year').nullable()
      table
        .specificType('validation_status', 'staging_validation_status')
        .notNullable()
        .defaultTo('pending')
      table.jsonb('errors').nullable()
      table.timestamp('processed_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(['import_id', 'validation_status'])
      table.index(['normalized_cnj'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
