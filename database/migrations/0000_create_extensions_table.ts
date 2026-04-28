import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.db.rawQuery(`
      create extension if not exists pgcrypto;
      create extension if not exists citext;
      create extension if not exists timescaledb;
    `)
  }

  async down() {
    await this.db.rawQuery(`
      drop extension if exists timescaledb;
      drop extension if exists citext;
      drop extension if exists pgcrypto;
    `)
  }
}
