import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('asset_budget_facts', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table
        .uuid('asset_id')
        .notNullable()
        .references('id')
        .inTable('precatorio_assets')
        .onDelete('CASCADE')
      table.integer('exercise_year').nullable()
      table.integer('budget_year').nullable()
      table
        .uuid('budget_unit_id')
        .nullable()
        .references('id')
        .inTable('budget_units')
        .onDelete('SET NULL')
      table.text('expense_type').nullable()
      table.text('cause_type').nullable()
      table.text('nature_expense_code').nullable()
      table.text('value_range').nullable()
      table.boolean('tax_claim').nullable()
      table.boolean('fundef').nullable()
      table.integer('elapsed_years').nullable()
      table.text('elapsed_years_class').nullable()
      table
        .uuid('source_record_id')
        .nullable()
        .references('id')
        .inTable('source_records')
        .onDelete('SET NULL')
      table.jsonb('raw_data').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(['tenant_id', 'asset_id'])
      table.index(['tenant_id', 'budget_unit_id'])
      table.index(['tenant_id', 'exercise_year'])
      table.unique(['tenant_id', 'asset_id', 'exercise_year', 'budget_year', 'source_record_id'])
    })

    this.schema.createTable('asset_valuations', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table
        .uuid('asset_id')
        .notNullable()
        .references('id')
        .inTable('precatorio_assets')
        .onDelete('CASCADE')
      table.decimal('face_value', 18, 2).nullable()
      table.decimal('estimated_updated_value', 18, 2).nullable()
      table.date('base_date').nullable()
      table.date('correction_started_at').nullable()
      table.date('correction_ended_at').nullable()
      table.decimal('correction_index', 24, 16).nullable()
      table.integer('queue_position').nullable()
      table
        .uuid('source_record_id')
        .nullable()
        .references('id')
        .inTable('source_records')
        .onDelete('SET NULL')
      table.timestamp('computed_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.jsonb('raw_data').nullable()

      table.index(['tenant_id', 'asset_id', 'computed_at'])
      table.index(['tenant_id', 'base_date'])
    })

    this.defer((db) =>
      db.rawQuery(`
        alter table asset_budget_facts
        add constraint asset_budget_facts_asset_same_tenant_fk
        foreign key (tenant_id, asset_id)
        references precatorio_assets (tenant_id, id)
        on delete cascade;

        alter table asset_valuations
        add constraint asset_valuations_asset_same_tenant_fk
        foreign key (tenant_id, asset_id)
        references precatorio_assets (tenant_id, id)
        on delete cascade;
      `)
    )
  }

  async down() {
    this.schema.dropTable('asset_valuations')
    this.schema.dropTable('asset_budget_facts')
  }
}
