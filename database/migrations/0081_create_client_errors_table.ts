import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'client_errors'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').nullable().references('id').inTable('tenants').onDelete('SET NULL')
      table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      table.specificType('status', 'client_error_status').notNullable().defaultTo('new')
      table.text('message').notNullable()
      table.text('stack_hash').nullable()
      table.text('url').nullable()
      table.text('user_agent').nullable()
      table.jsonb('payload').nullable()
      table.text('request_id').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(['tenant_id', 'status', 'created_at'])
      table.index(['stack_hash', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
