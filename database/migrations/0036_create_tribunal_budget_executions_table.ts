import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('tribunal_budget_executions', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table
        .uuid('source_record_id')
        .notNullable()
        .references('id')
        .inTable('source_records')
        .onDelete('CASCADE')
      table
        .uuid('source_dataset_id')
        .nullable()
        .references('id')
        .inTable('source_datasets')
        .onDelete('SET NULL')
      table.uuid('court_id').nullable().references('id').inTable('courts').onDelete('SET NULL')
      table
        .uuid('budget_unit_id')
        .nullable()
        .references('id')
        .inTable('budget_units')
        .onDelete('SET NULL')
      table.text('court_alias').notNullable()
      table.text('source_kind').notNullable()
      table.integer('reference_year').nullable()
      table.integer('reference_month').nullable()
      table.text('budget_unit_code').nullable()
      table.text('budget_unit_name').nullable()
      table.text('function_subfunction').nullable()
      table.text('programmatic_code').nullable()
      table.text('program_name').nullable()
      table.text('action_name').nullable()
      table.text('sphere_code').nullable()
      table.text('funding_source_code').nullable()
      table.text('funding_source_name').nullable()
      table.text('expense_group_code').nullable()
      table.decimal('initial_allocation', 18, 2).nullable()
      table.decimal('additional_credits_increase', 18, 2).nullable()
      table.decimal('additional_credits_decrease', 18, 2).nullable()
      table.decimal('updated_allocation', 18, 2).nullable()
      table.decimal('contingency_amount', 18, 2).nullable()
      table.decimal('credit_provision_amount', 18, 2).nullable()
      table.decimal('credit_highlight_amount', 18, 2).nullable()
      table.decimal('net_allocation', 18, 2).nullable()
      table.decimal('committed_amount', 18, 2).nullable()
      table.decimal('committed_percent', 8, 4).nullable()
      table.decimal('liquidated_amount', 18, 2).nullable()
      table.decimal('liquidated_percent', 8, 4).nullable()
      table.decimal('paid_amount', 18, 2).nullable()
      table.decimal('paid_percent', 8, 4).nullable()
      table.text('row_fingerprint').notNullable()
      table.jsonb('raw_data').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(['tenant_id', 'court_alias'])
      table.index(['tenant_id', 'source_record_id'])
      table.index(['tenant_id', 'reference_year', 'reference_month'])
      table.index(['tenant_id', 'budget_unit_id'])
      table.unique(['tenant_id', 'source_record_id', 'row_fingerprint'])
    })
  }

  async down() {
    this.schema.dropTable('tribunal_budget_executions')
  }
}
