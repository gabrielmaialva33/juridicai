import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'market_rates'

  async up() {
    this.schema.createTable('market_rate_series', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.text('key').notNullable().unique()
      table.text('code').nullable()
      table.text('source').notNullable().defaultTo('bcb_sgs')
      table.text('periodicity').notNullable().checkIn(['daily', 'monthly', 'annual', 'derived'])
      table.text('unit').notNullable().defaultTo('decimal_rate')
      table.text('description').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('series_id')
        .nullable()
        .references('id')
        .inTable('market_rate_series')
        .onDelete('CASCADE')
      table
        .text('series_key')
        .notNullable()
        .checkIn(['cdi', 'selic', 'ipca', 'ipca_plus_2', 'ec_136_cap'])
      table.text('series_code').nullable()
      table.text('source').notNullable().defaultTo('bcb_sgs')
      table.date('rate_date').notNullable()
      table.decimal('value', 18, 10).notNullable()
      table.text('periodicity').notNullable().checkIn(['daily', 'monthly', 'annual', 'derived'])
      table.text('unit').notNullable().defaultTo('decimal_rate')
      table.jsonb('raw_data').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['series_key', 'rate_date'])
      table.unique(['series_id', 'rate_date'])
      table.index(['series_id', 'rate_date'])
      table.index(['series_key', 'rate_date'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.dropTable('market_rate_series')
  }
}
