import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.db.rawQuery(`
      drop schema if exists pii cascade;
      create schema pii;
    `)
  }

  async down() {
    await this.db.rawQuery(`drop schema if exists pii cascade;`)
  }
}
