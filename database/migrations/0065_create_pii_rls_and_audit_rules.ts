import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.db.rawQuery(`
      alter table pii.beneficiaries enable row level security;
      alter table pii.asset_beneficiaries enable row level security;
      alter table pii.access_logs enable row level security;

      create policy pii_beneficiaries_tenant_policy on pii.beneficiaries
        using (tenant_id::text = current_setting('app.tenant_id', true));

      create policy pii_asset_beneficiaries_tenant_policy on pii.asset_beneficiaries
        using (tenant_id::text = current_setting('app.tenant_id', true));

      create policy pii_access_logs_tenant_policy on pii.access_logs
        using (tenant_id::text = current_setting('app.tenant_id', true));

      create or replace function pii.prevent_access_log_mutation()
      returns trigger
      language plpgsql
      as $$
      begin
        raise exception 'pii.access_logs is append-only';
      end;
      $$;

      create trigger pii_access_logs_no_update
        before update on pii.access_logs
        for each row execute function pii.prevent_access_log_mutation();

      create trigger pii_access_logs_no_delete
        before delete on pii.access_logs
        for each row execute function pii.prevent_access_log_mutation();
    `)
  }

  async down() {
    await this.db.rawQuery(`
      drop trigger if exists pii_access_logs_no_delete on pii.access_logs;
      drop trigger if exists pii_access_logs_no_update on pii.access_logs;
      drop function if exists pii.prevent_access_log_mutation();
      drop policy if exists pii_access_logs_tenant_policy on pii.access_logs;
      drop policy if exists pii_asset_beneficiaries_tenant_policy on pii.asset_beneficiaries;
      drop policy if exists pii_beneficiaries_tenant_policy on pii.beneficiaries;
    `)
  }
}
