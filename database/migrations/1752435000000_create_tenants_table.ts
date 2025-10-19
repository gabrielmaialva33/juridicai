import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'tenants'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)

      table.string('name', 255).notNullable()
      table.string('subdomain', 100).notNullable().unique()
      table.string('custom_domain', 255).nullable()
      table.enum('plan', ['free', 'starter', 'pro', 'enterprise']).notNullable().defaultTo('free')
      table.boolean('is_active').notNullable().defaultTo(true)
      table.jsonb('limits').nullable()
      table.timestamp('trial_ends_at').nullable()
      table.timestamp('suspended_at').nullable()
      table.text('suspended_reason').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    // Indexes
    this.schema.raw('CREATE INDEX idx_tenants_subdomain ON tenants(subdomain)')
    this.schema.raw('CREATE INDEX idx_tenants_is_active ON tenants(is_active)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
