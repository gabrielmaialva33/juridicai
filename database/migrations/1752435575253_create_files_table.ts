import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'files'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')

      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')

      table.bigInteger('owner_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.string('client_name').notNullable()
      table.string('file_name').notNullable()
      table.integer('file_size').notNullable()
      table.string('file_type').notNullable()
      table.string('file_category').notNullable()
      table.string('url').notNullable()

      table.index(['tenant_id', 'owner_id'], 'idx_files_tenant_owner')

      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
