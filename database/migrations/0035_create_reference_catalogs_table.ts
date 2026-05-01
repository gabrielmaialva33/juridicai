import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('courts', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.text('code').notNullable()
      table.text('alias').nullable()
      table.text('name').notNullable()
      table.text('court_class').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['code'])
      table.index(['alias'])
    })

    this.schema.createTable('judicial_systems', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.integer('code').notNullable().unique()
      table.text('name').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.createTable('process_formats', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.integer('code').notNullable().unique()
      table.text('name').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.createTable('judicial_classes', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.integer('code').notNullable().unique()
      table.text('name').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.createTable('judicial_subjects_catalog', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.integer('code').notNullable().unique()
      table.text('name').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.createTable('movement_types', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.integer('code').notNullable().unique()
      table.text('name').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.createTable('movement_complement_types', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.integer('code').notNullable()
      table.integer('value').nullable()
      table.text('name').nullable()
      table.text('description').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['code', 'value'])
    })

    this.schema.createTable('judging_bodies', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('court_id').nullable().references('id').inTable('courts').onDelete('SET NULL')
      table.text('code').notNullable()
      table.text('name').notNullable()
      table.integer('municipality_ibge_code').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['court_id', 'code'])
      table.index(['municipality_ibge_code'])
    })

    this.schema.createTable('budget_units', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.text('code').notNullable().unique()
      table.text('name').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable('budget_units')
    this.schema.dropTable('judging_bodies')
    this.schema.dropTable('movement_complement_types')
    this.schema.dropTable('movement_types')
    this.schema.dropTable('judicial_subjects_catalog')
    this.schema.dropTable('judicial_classes')
    this.schema.dropTable('process_formats')
    this.schema.dropTable('judicial_systems')
    this.schema.dropTable('courts')
  }
}
