import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('retention_config', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').nullable().references('id').inTable('tenants').onDelete('CASCADE')
      table.specificType('subject', 'retention_subject').notNullable()
      table.integer('retention_days').notNullable()
      table.boolean('enabled').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['tenant_id', 'subject'])
    })

    this.schema.createTable('retention_manifest', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').nullable().references('id').inTable('tenants').onDelete('SET NULL')
      table.specificType('subject', 'retention_subject').notNullable()
      table.integer('deleted_count').notNullable().defaultTo(0)
      table.timestamp('cutoff_at', { useTz: true }).notNullable()
      table.jsonb('metadata').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable('retention_manifest')
    this.schema.dropTable('retention_config')
  }
}
