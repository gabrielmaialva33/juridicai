import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'debtor_payment_stats'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table.uuid('debtor_id').notNullable().references('id').inTable('debtors').onDelete('CASCADE')
      table.date('period_start').nullable()
      table.date('period_end').nullable()
      table.integer('sample_size').notNullable().defaultTo(0)
      table.integer('average_payment_months').nullable()
      table.decimal('on_time_payment_rate', 8, 6).nullable()
      table.decimal('paid_volume', 18, 2).nullable()
      table.decimal('open_debt_stock', 18, 2).nullable()
      table.decimal('rcl_debt_ratio', 10, 6).nullable()
      table.boolean('regime_special_active').notNullable().defaultTo(false)
      table.boolean('recent_default').notNullable().defaultTo(false)
      table.smallint('reliability_score').nullable()
      table.text('source').notNullable().defaultTo('manual')
      table.jsonb('raw_data').nullable()
      table.timestamp('computed_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['tenant_id', 'debtor_id', 'source'])
      table.index(['tenant_id', 'debtor_id'])
      table.index(['tenant_id', 'reliability_score'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
