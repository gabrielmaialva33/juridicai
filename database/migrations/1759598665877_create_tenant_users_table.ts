import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'tenant_users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()

      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table
        .bigInteger('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table
        .enum('role', ['owner', 'admin', 'lawyer', 'assistant'])
        .notNullable()
        .defaultTo('lawyer')
      table.jsonb('custom_permissions').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('invited_at', { useTz: true }).nullable()
      table.timestamp('joined_at', { useTz: true }).nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      // Constraints
      table.unique(['tenant_id', 'user_id'])
    })

    // Indexes
    this.schema.raw('CREATE INDEX idx_tenant_users_tenant_id ON tenant_users(tenant_id)')
    this.schema.raw('CREATE INDEX idx_tenant_users_user_id ON tenant_users(user_id)')
    this.schema.raw('CREATE INDEX idx_tenant_users_is_active ON tenant_users(is_active)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
