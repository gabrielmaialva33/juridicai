import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'roles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')

      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')

      table.string('name').notNullable()
      table.text('description').nullable()
      table.string('slug').notNullable()

      table.unique(['tenant_id', 'slug'])

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
