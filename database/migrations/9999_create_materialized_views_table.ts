import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.db.rawQuery(`
      create materialized view dashboard_asset_metrics as
      select
        a.tenant_id,
        count(*)::bigint as total_assets,
        count(*) filter (where a.lifecycle_status = 'paid')::bigint as paid_assets,
        count(*) filter (where a.compliance_status = 'approved_for_analysis')::bigint as approved_for_analysis,
        coalesce(sum(v.face_value), 0)::numeric(18,2) as total_face_value,
        coalesce(sum(v.estimated_updated_value), 0)::numeric(18,2) as total_estimated_updated_value,
        now() as refreshed_at
      from precatorio_assets a
      left join lateral (
        select av.face_value, av.estimated_updated_value
        from asset_valuations av
        where av.tenant_id = a.tenant_id
          and av.asset_id = a.id
        order by av.computed_at desc, av.id desc
        limit 1
      ) v on true
      where a.deleted_at is null
      group by a.tenant_id
      with no data;

      create unique index dashboard_asset_metrics_tenant_uq
      on dashboard_asset_metrics (tenant_id);

      create materialized view debtor_aggregates as
      select
        d.tenant_id,
        d.id as debtor_id,
        d.name,
        count(a.id)::bigint as asset_count,
        coalesce(sum(v.face_value), 0)::numeric(18,2) as total_face_value,
        coalesce(avg(a.current_score), 0)::numeric(10,2) as average_score,
        now() as refreshed_at
      from debtors d
      left join precatorio_assets a on a.debtor_id = d.id and a.deleted_at is null
      left join lateral (
        select av.face_value
        from asset_valuations av
        where av.tenant_id = a.tenant_id
          and av.asset_id = a.id
        order by av.computed_at desc, av.id desc
        limit 1
      ) v on true
      where d.deleted_at is null
      group by d.tenant_id, d.id, d.name
      with no data;

      create unique index debtor_aggregates_tenant_debtor_uq
      on debtor_aggregates (tenant_id, debtor_id);

      create materialized view asset_yearly_stats as
      select
        a.tenant_id,
        a.exercise_year,
        count(*)::bigint as asset_count,
        coalesce(sum(v.face_value), 0)::numeric(18,2) as total_face_value,
        coalesce(sum(v.estimated_updated_value), 0)::numeric(18,2) as total_estimated_updated_value,
        now() as refreshed_at
      from precatorio_assets a
      left join lateral (
        select av.face_value, av.estimated_updated_value
        from asset_valuations av
        where av.tenant_id = a.tenant_id
          and av.asset_id = a.id
        order by av.computed_at desc, av.id desc
        limit 1
      ) v on true
      where a.deleted_at is null
      group by a.tenant_id, a.exercise_year
      with no data;

      create unique index asset_yearly_stats_tenant_year_uq
      on asset_yearly_stats (tenant_id, exercise_year);
    `)
  }

  async down() {
    await this.db.rawQuery(`
      drop materialized view if exists asset_yearly_stats;
      drop materialized view if exists debtor_aggregates;
      drop materialized view if exists dashboard_asset_metrics;
    `)
  }
}
