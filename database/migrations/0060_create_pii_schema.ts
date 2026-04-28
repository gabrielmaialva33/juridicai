import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.db.rawQuery(`create schema if not exists pii;`)
  }

  async down() {
    await this.db.rawQuery(`drop schema if exists pii cascade;`)
  }
}
