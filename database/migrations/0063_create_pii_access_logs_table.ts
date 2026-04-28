import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.db.rawQuery(`
      create table pii.access_logs (
        id uuid not null default gen_random_uuid(),
        tenant_id uuid not null,
        user_id uuid,
        beneficiary_id uuid,
        asset_id uuid,
        action pii_action not null,
        reason text,
        allowed boolean not null default false,
        metadata jsonb,
        request_id text,
        ip_address inet,
        user_agent text,
        created_at timestamptz not null default now(),
        primary key (id, created_at)
      );

      select create_hypertable('pii.access_logs', by_range('created_at'), if_not_exists => true);

      create index pii_access_logs_tenant_created_idx
      on pii.access_logs (tenant_id, created_at desc);
    `)
  }

  async down() {
    await this.db.rawQuery(`drop table if exists pii.access_logs;`)
  }
}
