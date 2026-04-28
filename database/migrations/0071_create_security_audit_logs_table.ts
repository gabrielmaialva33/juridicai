import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'security_audit_logs'

  async up() {
    await this.db.rawQuery(`
      create table security_audit_logs (
        id uuid not null default gen_random_uuid(),
        tenant_id uuid,
        user_id uuid,
        event text not null,
        severity text not null default 'info',
        email_hash text,
        ip_address inet,
        user_agent text,
        metadata jsonb,
        request_id text,
        created_at timestamptz not null default now(),
        primary key (id, created_at)
      );

      select create_hypertable('security_audit_logs', by_range('created_at'), if_not_exists => true);

      create index security_audit_logs_tenant_created_idx
      on security_audit_logs (tenant_id, created_at desc);

      create index security_audit_logs_event_idx
      on security_audit_logs (event, created_at desc);

      alter table security_audit_logs enable row level security;

      create policy security_audit_logs_tenant_policy on security_audit_logs
        using (tenant_id is null or tenant_id::text = current_setting('app.tenant_id', true));

      create or replace function prevent_security_audit_log_mutation()
      returns trigger
      language plpgsql
      as $$
      begin
        raise exception 'security_audit_logs is append-only';
      end;
      $$;

      create trigger security_audit_logs_no_update
        before update on security_audit_logs
        for each row execute function prevent_security_audit_log_mutation();

      create trigger security_audit_logs_no_delete
        before delete on security_audit_logs
        for each row execute function prevent_security_audit_log_mutation();
    `)
  }

  async down() {
    await this.db.rawQuery(`drop function if exists prevent_security_audit_log_mutation() cascade;`)
    this.schema.dropTable(this.tableName)
  }
}
