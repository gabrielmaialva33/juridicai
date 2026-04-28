import { BaseSchema } from '@adonisjs/lucid/schema'

const enumTypes = [
  'retention_subject',
  'client_error_status',
  'export_status',
  'pii_action',
  'job_run_origin',
  'job_run_status',
  'staging_validation_status',
  'import_status',
  'payment_regime',
  'asset_nature',
  'source_type',
  'debtor_type',
  'compliance_status',
  'pii_status',
  'lifecycle_status',
  'membership_status',
  'user_status',
  'tenant_status',
]

export default class extends BaseSchema {
  async up() {
    await this.db.rawQuery(`
      do $$ begin
        if to_regtype('tenant_status') is null then
          create type tenant_status as enum ('active', 'suspended', 'inactive');
        end if;
        if to_regtype('user_status') is null then
          create type user_status as enum ('active', 'disabled');
        end if;
        if to_regtype('membership_status') is null then
          create type membership_status as enum ('active', 'inactive');
        end if;
        if to_regtype('lifecycle_status') is null then
          create type lifecycle_status as enum (
            'unknown', 'discovered', 'expedited', 'pending', 'in_payment', 'paid', 'cancelled', 'suspended'
          );
        end if;
        if to_regtype('pii_status') is null then
          create type pii_status as enum (
            'none', 'pseudonymous', 'bunker_available', 'materialized', 'blocked'
          );
        end if;
        if to_regtype('compliance_status') is null then
          create type compliance_status as enum (
            'pending', 'approved_for_analysis', 'approved_for_sales', 'blocked', 'opt_out'
          );
        end if;
        if to_regtype('debtor_type') is null then
          create type debtor_type as enum ('union', 'state', 'municipality', 'autarchy', 'foundation');
        end if;
        if to_regtype('source_type') is null then
          create type source_type as enum ('siop', 'datajud', 'djen', 'tribunal', 'api_private', 'manual');
        end if;
        if to_regtype('asset_nature') is null then
          create type asset_nature as enum ('alimentar', 'comum', 'tributario', 'unknown');
        end if;
        if to_regtype('payment_regime') is null then
          create type payment_regime as enum ('none', 'special', 'federal_unique', 'other');
        end if;
        if to_regtype('import_status') is null then
          create type import_status as enum ('pending', 'running', 'completed', 'partial', 'failed');
        end if;
        if to_regtype('staging_validation_status') is null then
          create type staging_validation_status as enum ('pending', 'valid', 'invalid', 'warning');
        end if;
        if to_regtype('job_run_status') is null then
          create type job_run_status as enum ('pending', 'running', 'completed', 'failed', 'skipped', 'cancelled');
        end if;
        if to_regtype('job_run_origin') is null then
          create type job_run_origin as enum ('scheduler', 'http', 'manual_retry', 'system');
        end if;
        if to_regtype('pii_action') is null then
          create type pii_action as enum (
            'attempt_reveal', 'reveal_denied', 'reveal_success', 'export', 'contact', 'update', 'delete'
          );
        end if;
        if to_regtype('export_status') is null then
          create type export_status as enum ('pending', 'running', 'completed', 'failed', 'expired');
        end if;
        if to_regtype('client_error_status') is null then
          create type client_error_status as enum ('new', 'triaged', 'resolved', 'ignored');
        end if;
        if to_regtype('retention_subject') is null then
          create type retention_subject as enum ('audit_logs', 'pii_access_logs', 'source_records', 'exports', 'client_errors');
        end if;
      end $$;
    `)
  }

  async down() {
    for (const enumType of enumTypes) {
      await this.db.rawQuery(`drop type if exists ${enumType};`)
    }
  }
}
