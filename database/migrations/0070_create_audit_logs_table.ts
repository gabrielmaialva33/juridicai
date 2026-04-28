import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'audit_logs'

  async up() {
    await this.db.rawQuery(`
      create table audit_logs (
        id uuid not null default gen_random_uuid(),
        tenant_id uuid,
        user_id uuid,
        event text not null,
        entity_type text,
        entity_id uuid,
        old_values jsonb,
        new_values jsonb,
        metadata jsonb,
        request_id text,
        ip_address inet,
        user_agent text,
        created_at timestamptz not null default now(),
        primary key (id, created_at)
      );

      select create_hypertable('audit_logs', by_range('created_at'), if_not_exists => true);

      create index audit_logs_tenant_created_idx on audit_logs (tenant_id, created_at desc);
      create index audit_logs_entity_idx on audit_logs (entity_type, entity_id, created_at desc);

      alter table audit_logs enable row level security;

      create policy audit_logs_tenant_policy on audit_logs
        using (tenant_id is null or tenant_id::text = current_setting('app.tenant_id', true));

      create or replace function prevent_audit_log_mutation()
      returns trigger
      language plpgsql
      as $$
      begin
        raise exception 'audit_logs is append-only';
      end;
      $$;

      create trigger audit_logs_no_update
        before update on audit_logs
        for each row execute function prevent_audit_log_mutation();

      create trigger audit_logs_no_delete
        before delete on audit_logs
        for each row execute function prevent_audit_log_mutation();
    `)
  }

  async down() {
    await this.db.rawQuery(`drop function if exists prevent_audit_log_mutation() cascade;`)
    this.schema.dropTable(this.tableName)
  }
}
