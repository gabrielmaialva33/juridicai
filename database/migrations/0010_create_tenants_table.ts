import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'tenants'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.text('name').notNullable()
      table.text('slug').notNullable().unique()
      table.text('document').nullable()
      table.specificType('status', 'tenant_status').notNullable().defaultTo('active')
      table.text('plan').nullable()
      table.integer('rbac_version').notNullable().defaultTo(1)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
