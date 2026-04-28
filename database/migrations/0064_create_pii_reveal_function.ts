import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.db.rawQuery(`
      create or replace function pii.reveal_beneficiary(
        p_tenant_id uuid,
        p_beneficiary_id uuid,
        p_user_id uuid,
        p_reason text
      )
      returns table (
        id uuid,
        name text,
        document text,
        email text,
        phone text
      )
      language plpgsql
      security definer
      set search_path = pii, public
      as $$
      declare
        encryption_key text;
      begin
        encryption_key := current_setting('app.pii_encryption_key', true);

        if encryption_key is null or encryption_key = '' then
          insert into pii.access_logs (tenant_id, user_id, beneficiary_id, action, reason, allowed)
          values (p_tenant_id, p_user_id, p_beneficiary_id, 'reveal_denied', p_reason, false);

          raise exception 'PII encryption key is not configured';
        end if;

        insert into pii.access_logs (tenant_id, user_id, beneficiary_id, action, reason, allowed)
        values (p_tenant_id, p_user_id, p_beneficiary_id, 'reveal_success', p_reason, true);

        return query
        select
          b.id,
          nullif(pgp_sym_decrypt(b.name_encrypted, encryption_key), '') as name,
          nullif(pgp_sym_decrypt(b.document_encrypted, encryption_key), '') as document,
          nullif(pgp_sym_decrypt(b.email_encrypted, encryption_key), '') as email,
          nullif(pgp_sym_decrypt(b.phone_encrypted, encryption_key), '') as phone
        from pii.beneficiaries b
        where b.tenant_id = p_tenant_id
          and b.id = p_beneficiary_id
          and b.deleted_at is null;
      end;
      $$;
    `)
  }

  async down() {
    await this.db.rawQuery(
      `drop function if exists pii.reveal_beneficiary(uuid, uuid, uuid, text);`
    )
  }
}
