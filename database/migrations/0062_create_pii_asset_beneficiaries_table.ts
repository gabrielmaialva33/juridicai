import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.db.rawQuery(`
      create table pii.asset_beneficiaries (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references public.tenants(id) on delete cascade,
        asset_id uuid not null references public.precatorio_assets(id) on delete cascade,
        beneficiary_id uuid not null references pii.beneficiaries(id) on delete restrict,
        relationship_type text not null default 'beneficiary',
        share_percent numeric(7,4),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (tenant_id, asset_id, beneficiary_id)
      );

      create index pii_asset_beneficiaries_asset_idx
      on pii.asset_beneficiaries (tenant_id, asset_id);
    `)
  }

  async down() {
    await this.db.rawQuery(`drop table if exists pii.asset_beneficiaries;`)
  }
}
