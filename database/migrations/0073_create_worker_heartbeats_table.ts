import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'worker_heartbeats'

  async up() {
    await this.db.rawQuery(`
      create table worker_heartbeats (
        worker_id text not null,
        queue_name text not null,
        hostname text,
        pid integer,
        metadata jsonb,
        checked_at timestamptz not null default now(),
        primary key (worker_id, checked_at)
      );

      select create_hypertable('worker_heartbeats', by_range('checked_at'), if_not_exists => true);

      create index worker_heartbeats_queue_checked_idx
      on worker_heartbeats (queue_name, checked_at desc);
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
