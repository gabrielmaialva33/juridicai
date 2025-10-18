import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').notNullable().primary()

      table.uuid('tenant_id').notNullable().index()

      table.string('full_name').notNullable()

      table.string('email', 254).notNullable()
      table.string('username', 80).nullable()
      table.string('password').notNullable()

      table.string('firebase_uid').nullable().unique()
      table.index('firebase_uid')

      table.boolean('is_deleted').defaultTo(false)

      // Composite unique index for email per tenant
      table.unique(['tenant_id', 'email'])
      table.unique(['tenant_id', 'username'])

      table.jsonb('metadata').defaultTo(
        JSON.stringify({
          email_verified: false,
          email_verification_token: null,
          email_verification_sent_at: null,
          email_verified_at: null,
        })
      )

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
