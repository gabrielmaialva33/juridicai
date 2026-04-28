import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.db.rawQuery(`
      create table pii.beneficiaries (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references public.tenants(id) on delete cascade,
        beneficiary_hash text not null,
        name_encrypted bytea,
        document_encrypted bytea,
        email_encrypted bytea,
        phone_encrypted bytea,
        status pii_status not null default 'bunker_available',
        legal_basis text,
        raw_metadata jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        deleted_at timestamptz,
        unique (tenant_id, beneficiary_hash)
      );

      create index pii_beneficiaries_tenant_hash_idx
      on pii.beneficiaries (tenant_id, beneficiary_hash);
    `)
  }

  async down() {
    await this.db.rawQuery(`drop table if exists pii.beneficiaries;`)
  }
}
