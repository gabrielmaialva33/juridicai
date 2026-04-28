import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'debtors'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table.text('name').notNullable()
      table.text('normalized_name').notNullable()
      table.text('normalized_key').notNullable()
      table.specificType('debtor_type', 'debtor_type').notNullable()
      table.text('cnpj').nullable()
      table.specificType('state_code', 'char(2)').nullable()
      table.specificType('payment_regime', 'payment_regime').nullable()
      table.decimal('rcl_estimate', 18, 2).nullable()
      table.decimal('debt_stock_estimate', 18, 2).nullable()
      table.smallint('payment_reliability_score').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('deleted_at', { useTz: true }).nullable()

      table.index(['tenant_id', 'normalized_key'])
    })

    this.defer((db) =>
      db.rawQuery(`
        create unique index debtors_tenant_type_cnpj_uq
        on debtors (tenant_id, debtor_type, cnpj)
        where cnpj is not null;

        create unique index debtors_tenant_type_state_key_uq
        on debtors (tenant_id, debtor_type, state_code, normalized_key)
        where cnpj is null;
      `)
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
