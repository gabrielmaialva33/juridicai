import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'time_entries'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // Tenant isolation
      table.uuid('tenant_id').notNullable()

      // Relations
      table.integer('user_id').unsigned().notNullable()
      table.integer('case_id').unsigned().notNullable()

      // Time tracking
      table.timestamp('started_at').notNullable()
      table.timestamp('ended_at').nullable()
      table.integer('duration_minutes').unsigned().nullable()

      // Details
      table.text('description').nullable()
      table.boolean('billable').defaultTo(true)
      table.decimal('hourly_rate', 10, 2).nullable()

      // Tags for categorization
      table.specificType('tags', 'text[]').defaultTo('{}')

      // Soft delete
      table.boolean('is_deleted').defaultTo(false)

      // Timestamps
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })

      // Indexes
      table.index(['tenant_id', 'user_id'], 'time_entries_tenant_user_index')
      table.index(['tenant_id', 'case_id'], 'time_entries_tenant_case_index')
      table.index(['tenant_id', 'started_at'], 'time_entries_tenant_started_index')
      table.index(['tenant_id', 'billable'], 'time_entries_tenant_billable_index')
      table.index(['tenant_id', 'is_deleted'], 'time_entries_tenant_deleted_index')

      // Foreign keys
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE')
      table.foreign('case_id').references('id').inTable('cases').onDelete('CASCADE')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
