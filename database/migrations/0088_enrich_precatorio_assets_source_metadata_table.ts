import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'precatorio_assets'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('court_code').nullable()
      table.text('court_name').nullable()
      table.text('court_class').nullable()
      table.text('budget_unit_code').nullable()
      table.text('budget_unit_name').nullable()
      table.text('expense_type').nullable()
      table.text('cause_type').nullable()
      table.text('nature_expense_code').nullable()
      table.text('value_range').nullable()
      table.boolean('tax_claim').nullable()
      table.boolean('fundef').nullable()
      table.integer('elapsed_years').nullable()
      table.text('elapsed_years_class').nullable()
      table.date('origin_filed_at').nullable()
      table.date('autuated_at').nullable()
      table.date('correction_started_at').nullable()
      table.date('correction_ended_at').nullable()
      table.decimal('correction_index', 24, 16).nullable()

      table.index(['tenant_id', 'court_code'])
      table.index(['tenant_id', 'budget_unit_code'])
      table.index(['tenant_id', 'origin_filed_at'])
      table.index(['tenant_id', 'autuated_at'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['tenant_id', 'court_code'])
      table.dropIndex(['tenant_id', 'budget_unit_code'])
      table.dropIndex(['tenant_id', 'origin_filed_at'])
      table.dropIndex(['tenant_id', 'autuated_at'])

      table.dropColumns(
        'court_code',
        'court_name',
        'court_class',
        'budget_unit_code',
        'budget_unit_name',
        'expense_type',
        'cause_type',
        'nature_expense_code',
        'value_range',
        'tax_claim',
        'fundef',
        'elapsed_years',
        'elapsed_years_class',
        'origin_filed_at',
        'autuated_at',
        'correction_started_at',
        'correction_ended_at',
        'correction_index'
      )
    })
  }
}
