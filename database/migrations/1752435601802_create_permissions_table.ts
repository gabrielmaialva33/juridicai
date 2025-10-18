import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'permissions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')

      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')

      table.string('name', 255).notNullable()
      table.string('description', 500).nullable()
      table.string('resource', 100).notNullable()
      table.string('action', 50).notNullable()
      table.string('context', 50).nullable().defaultTo('any')

      table.unique(['tenant_id', 'resource', 'action', 'context'])
      table.index(['tenant_id', 'resource', 'action', 'context'], 'idx_permissions_tenant_resource_action_context')

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
