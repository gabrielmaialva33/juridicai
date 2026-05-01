import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'cession_opportunities'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table
        .uuid('asset_id')
        .notNullable()
        .references('id')
        .inTable('precatorio_assets')
        .onDelete('CASCADE')
      table
        .text('stage')
        .notNullable()
        .defaultTo('inbox')
        .checkIn([
          'inbox',
          'qualified',
          'contact',
          'offer',
          'due_diligence',
          'cession',
          'paid',
          'lost',
        ])
      table.decimal('offer_rate', 8, 6).nullable()
      table.decimal('offer_value', 18, 2).nullable()
      table.integer('term_months').nullable()
      table.decimal('expected_annual_irr', 10, 6).nullable()
      table.decimal('risk_adjusted_irr', 10, 6).nullable()
      table.decimal('payment_probability', 8, 6).nullable()
      table.decimal('final_score', 8, 6).nullable()
      table.text('grade').nullable()
      table.integer('priority').notNullable().defaultTo(0)
      table.timestamp('target_close_at', { useTz: true }).nullable()
      table.timestamp('last_contacted_at', { useTz: true }).nullable()
      table.jsonb('pricing_snapshot').nullable()
      table.jsonb('metadata').nullable()
      table.text('notes').nullable()
      table
        .uuid('created_by_user_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table
        .uuid('updated_by_user_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['tenant_id', 'asset_id'])
      table.index(['tenant_id', 'stage'])
      table.index(['tenant_id', 'grade'])
      table.index(['tenant_id', 'risk_adjusted_irr'])
      table.index(['tenant_id', 'target_close_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
