import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'radar_job_runs'

  async up() {
    await this.db.rawQuery(`
      create table radar_job_runs (
        id uuid not null default gen_random_uuid(),
        tenant_id uuid references tenants(id) on delete set null,
        job_name text not null,
        queue_name text,
        bullmq_job_id text,
        status job_run_status not null default 'pending',
        origin job_run_origin not null default 'system',
        started_at timestamptz,
        finished_at timestamptz,
        duration_ms integer,
        attempts integer not null default 0,
        metrics jsonb,
        error_code text,
        error_message text,
        metadata jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (id, created_at)
      );

      select create_hypertable('radar_job_runs', by_range('created_at'), if_not_exists => true);

      create index radar_job_runs_tenant_status_idx on radar_job_runs (tenant_id, status, created_at desc);
      create index radar_job_runs_job_name_idx on radar_job_runs (job_name, created_at desc);
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
