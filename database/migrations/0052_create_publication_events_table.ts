import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'publication_events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table
        .uuid('publication_id')
        .notNullable()
        .references('id')
        .inTable('publications')
        .onDelete('CASCADE')
      table.text('event_type').notNullable()
      table.timestamp('event_date', { useTz: true }).notNullable().defaultTo(this.now())
      table.jsonb('payload').nullable()
      table.text('idempotency_key').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(['tenant_id', 'publication_id', 'event_date'])
      table.unique(['tenant_id', 'idempotency_key'])
    })

    this.defer((db) =>
      db.rawQuery(`
        alter table publication_events
        add constraint publication_events_publication_same_tenant_fk
        foreign key (tenant_id, publication_id)
        references publications (tenant_id, id)
        on delete cascade;
      `)
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
