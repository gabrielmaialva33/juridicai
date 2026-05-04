import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import queueService from '#shared/services/queue_service'
import workerHeartbeatService from '#shared/services/worker_heartbeat_service'
import { operationalQueueNames } from '#shared/constants/operational_queues'
import governmentCoverageMatrixService from '#modules/integrations/services/government_coverage_matrix_service'
import {
  ASSET_INTELLIGENCE_RECONCILE_RECENT_SUCCESS_HOURS,
  ASSET_INTELLIGENCE_RECONCILE_RUNNING_STALE_HOURS,
} from '#modules/operations/services/scheduled_asset_intelligence_reconcile_service'
import type { JsonRecord } from '#shared/types/model_enums'

const DEFAULT_TENANT_SLUG = 'juridicai-local'
const DEFAULT_USER_DOMAIN = '@juridicai.local'
const EXPECTED_DEFAULT_USERS = 4
const EXPECTED_MINIMUM_ROLES = 4
const EXPECTED_MINIMUM_PERMISSIONS = 15
const EXPECTED_STATE_DATAJUD_TARGETS = 27
const EVIDENCE_LATEST_COLUMNS: Record<string, string> = {
  asset_scores: 'computed_at',
  asset_valuations: 'computed_at',
}

type ReadinessStatus = 'pass' | 'warn' | 'fail'

type BetaReadinessOptions = {
  tenantId?: string | null
  tenantSlug?: string | null
  now?: DateTime
}

type ReadinessCheck = {
  key: string
  label: string
  status: ReadinessStatus
  message: string
  actual?: number | string | boolean | null
  expected?: number | string | boolean | null
  details?: JsonRecord | JsonRecord[] | null
}

type ReadinessSection = {
  key: string
  label: string
  status: ReadinessStatus
  checks: ReadinessCheck[]
}

class BetaReadinessService {
  async build(options: BetaReadinessOptions = {}) {
    const now = options.now ?? DateTime.utc()
    const database = await databaseCheck()

    if (database.status === 'fail') {
      const sections = [readinessSection('bootstrap', 'Bootstrap and RBAC', [database])]

      return readinessReport({
        now,
        tenant: null,
        status: 'fail',
        sections,
      })
    }

    const tenant = await resolveTenant(options)
    const sections = [
      await this.bootstrapSection(tenant, database),
      await this.integrationConfigSection(),
      await this.dataEvidenceSection(tenant?.id ?? null),
      await this.operationsSection(tenant?.id ?? null, now),
      await this.coverageSection(tenant?.id ?? null),
    ]
    const status = sectionStatus(sections)

    return readinessReport({ now, tenant, status, sections })
  }

  private async bootstrapSection(
    tenant: Record<string, any> | null,
    database: ReadinessCheck
  ): Promise<ReadinessSection> {
    const checks: ReadinessCheck[] = []
    checks.push(database)

    checks.push({
      key: 'tenant.active',
      label: 'Active beta tenant',
      status: tenant ? 'pass' : 'fail',
      message: tenant
        ? `Tenant ${tenant.slug} is active.`
        : `No active tenant found for ${DEFAULT_TENANT_SLUG}.`,
      actual: tenant?.slug ?? null,
      expected: DEFAULT_TENANT_SLUG,
    })

    const [defaultUsers, roles, permissions, memberships, userRoles, retentionPolicies] =
      await Promise.all([
        countDefaultUsers(),
        tableCount('roles'),
        tableCount('permissions'),
        tenant ? activeMembershipCount(String(tenant.id)) : Promise.resolve(0),
        tenant ? defaultUserRoleCount(String(tenant.id)) : Promise.resolve(0),
        tenant ? tenantTableCount('retention_config', String(tenant.id)) : Promise.resolve(0),
      ])

    checks.push(
      minimumCheck('users.default_local', 'Default local users', defaultUsers, {
        expected: EXPECTED_DEFAULT_USERS,
        failBelow: EXPECTED_DEFAULT_USERS,
      })
    )
    checks.push(
      minimumCheck('rbac.roles', 'Roles', roles, {
        expected: EXPECTED_MINIMUM_ROLES,
        failBelow: EXPECTED_MINIMUM_ROLES,
      })
    )
    checks.push(
      minimumCheck('rbac.permissions', 'Permissions', permissions, {
        expected: EXPECTED_MINIMUM_PERMISSIONS,
        failBelow: EXPECTED_MINIMUM_PERMISSIONS,
      })
    )
    checks.push(
      minimumCheck('tenant.memberships', 'Tenant memberships', memberships, {
        expected: EXPECTED_DEFAULT_USERS,
        failBelow: tenant ? EXPECTED_DEFAULT_USERS : 1,
      })
    )
    checks.push(
      minimumCheck('tenant.user_roles', 'Tenant user roles', userRoles, {
        expected: EXPECTED_DEFAULT_USERS,
        failBelow: tenant ? EXPECTED_DEFAULT_USERS : 1,
      })
    )
    checks.push(
      minimumCheck('retention.policies', 'Retention policies', retentionPolicies, {
        expected: 1,
        failBelow: 1,
      })
    )

    return readinessSection('bootstrap', 'Bootstrap and RBAC', checks)
  }

  private async integrationConfigSection(): Promise<ReadinessSection> {
    const [
      sourceDatasets,
      targets,
      activeTargets,
      dataJudTargets,
      djenTargets,
      stateDataJudTargets,
      primaryTargets,
    ] = await Promise.all([
      tableCount('source_datasets'),
      tableCount('government_source_targets'),
      db.from('government_source_targets').where('is_active', true).count('* as total').first(),
      db.from('government_source_targets').where('source', 'datajud').count('* as total').first(),
      db.from('government_source_targets').where('source', 'djen').count('* as total').first(),
      db
        .from('government_source_targets')
        .where('source', 'datajud')
        .where('federative_level', 'state')
        .count('* as total')
        .first(),
      db
        .from('government_source_targets')
        .where('priority', 'primary')
        .whereIn('source', ['siop', 'tribunal'])
        .count('* as total')
        .first(),
    ])
    const checks = [
      minimumCheck('sources.datasets', 'Source datasets', sourceDatasets, {
        expected: 1,
        failBelow: 1,
      }),
      minimumCheck('sources.targets', 'Government source targets', targets, {
        expected: 1,
        failBelow: 1,
      }),
      minimumCheck('sources.targets_active', 'Active source targets', numberFrom(activeTargets), {
        expected: 1,
        failBelow: 1,
      }),
      minimumCheck('sources.datajud', 'DataJud targets', numberFrom(dataJudTargets), {
        expected: EXPECTED_STATE_DATAJUD_TARGETS,
        warnBelow: EXPECTED_STATE_DATAJUD_TARGETS,
        failBelow: 1,
      }),
      minimumCheck(
        'sources.datajud_states',
        'State DataJud coverage targets',
        numberFrom(stateDataJudTargets),
        {
          expected: EXPECTED_STATE_DATAJUD_TARGETS,
          warnBelow: EXPECTED_STATE_DATAJUD_TARGETS,
          failBelow: 1,
        }
      ),
      minimumCheck('sources.djen', 'DJEN publication targets', numberFrom(djenTargets), {
        expected: 1,
        warnBelow: 1,
      }),
      minimumCheck('sources.primary', 'Primary SIOP/tribunal targets', numberFrom(primaryTargets), {
        expected: 1,
        failBelow: 1,
      }),
    ]

    return readinessSection('integration_config', 'Government Integration Configuration', checks)
  }

  private async dataEvidenceSection(tenantId: string | null): Promise<ReadinessSection> {
    const evidenceTables = [
      ['source_records', 'Source records'],
      ['siop_imports', 'SIOP imports'],
      ['coverage_runs', 'Coverage runs'],
      ['precatorio_assets', 'Precatorio assets'],
      ['asset_valuations', 'Asset valuations'],
      ['asset_budget_facts', 'Asset budget facts'],
      ['judicial_processes', 'Judicial processes'],
      ['publications', 'Publications'],
      ['asset_events', 'Asset events'],
      ['asset_scores', 'Asset scores'],
      ['cession_opportunities', 'Cession opportunities'],
    ] as const

    const checks = await Promise.all(
      evidenceTables.map(async ([tableName, label]) => {
        const count = tenantId ? await tenantTableCount(tableName, tenantId) : 0
        const latest = tenantId ? await latestCreatedAt(tableName, tenantId) : null

        return {
          key: `data.${tableName}`,
          label,
          status: count > 0 ? 'pass' : ('warn' as ReadinessStatus),
          message:
            count > 0
              ? `${label} has tenant-scoped records.`
              : `${label} is empty; run scheduled government sync or an inline ingestion drill.`,
          actual: count,
          expected: '> 0 after first ingestion run',
          details: latest ? { latestCreatedAt: latest } : null,
        }
      })
    )

    return readinessSection('data_evidence', 'Tenant Data Evidence', checks)
  }

  private async operationsSection(
    tenantId: string | null,
    now: DateTime
  ): Promise<ReadinessSection> {
    const checks: ReadinessCheck[] = []

    try {
      const [snapshots, workers] = await Promise.all([
        queueService.getSnapshots([...operationalQueueNames]),
        workerHeartbeatService.queueFreshness([...operationalQueueNames]),
      ])
      const workerByQueue = new Map(workers.map((worker) => [worker.queueName, worker]))
      const failedQueues = snapshots.filter((snapshot) => Number(snapshot.counts.failed ?? 0) > 0)
      const missingWorkers = snapshots.filter((snapshot) => {
        const worker = workerByQueue.get(snapshot.name)

        return !snapshot.worker.registered && worker?.status !== 'ok'
      })
      checks.push({
        key: 'queues.snapshots',
        label: 'Queue snapshots',
        status: failedQueues.length > 0 ? 'warn' : 'pass',
        message:
          failedQueues.length > 0
            ? `${failedQueues.length} queues have failed jobs.`
            : 'Operational queue snapshots are readable.',
        actual: snapshots.length,
        expected: operationalQueueNames.length,
        details: {
          failedQueues: failedQueues.map((queue) => queue.name),
          missingRegisteredWorkers: missingWorkers.map((queue) => queue.name),
        },
      })
    } catch (error) {
      checks.push({
        key: 'queues.snapshots',
        label: 'Queue snapshots',
        status: 'fail',
        message: `Queue snapshots are unavailable: ${errorMessage(error)}`,
        expected: 'Redis/BullMQ reachable',
      })
    }

    try {
      const workers = await workerHeartbeatService.queueFreshness([...operationalQueueNames])
      const staleWorkers = workers.filter((worker) => worker.status === 'stale')
      checks.push({
        key: 'workers.heartbeats',
        label: 'Worker heartbeats',
        status: staleWorkers.length > 0 ? 'warn' : 'pass',
        message:
          staleWorkers.length > 0
            ? `${staleWorkers.length} operational workers are stale or missing.`
            : 'Operational worker heartbeats are fresh.',
        actual: workers.length - staleWorkers.length,
        expected: operationalQueueNames.length,
        details: {
          staleWorkers: staleWorkers.map((worker) => worker.queueName),
        },
      })
    } catch (error) {
      checks.push({
        key: 'workers.heartbeats',
        label: 'Worker heartbeats',
        status: 'fail',
        message: `Worker heartbeats are unavailable: ${errorMessage(error)}`,
        expected: 'worker heartbeat table readable',
      })
    }

    checks.push(await latestJobRunCheck())
    checks.push(await latestAssetIntelligenceRunCheck(tenantId, now))

    return readinessSection('operations', 'Jobs, Queues, and Workers', checks)
  }

  private async coverageSection(tenantId: string | null): Promise<ReadinessSection> {
    if (!tenantId) {
      return readinessSection('coverage', 'Coverage Matrix', [
        {
          key: 'coverage.tenant',
          label: 'Coverage tenant',
          status: 'fail',
          message: 'Coverage matrix cannot run without an active tenant.',
        },
      ])
    }

    try {
      const matrix = await governmentCoverageMatrixService.build(tenantId)
      const highGaps = matrix.gaps.filter((gap) => gap.severity === 'high')
      const checks = [
        {
          key: 'coverage.states',
          label: 'State coverage matrix',
          status: matrix.summary.statesCount === EXPECTED_STATE_DATAJUD_TARGETS ? 'pass' : 'warn',
          message: `${matrix.summary.statesCount} Brazilian state courts are represented in coverage matrix.`,
          actual: matrix.summary.statesCount,
          expected: EXPECTED_STATE_DATAJUD_TARGETS,
        },
        {
          key: 'coverage.federal',
          label: 'Federal coverage matrix',
          status: matrix.federal.length >= 6 ? 'pass' : 'warn',
          message: `${matrix.federal.length} federal regional courts are represented.`,
          actual: matrix.federal.length,
          expected: 6,
        },
        {
          key: 'coverage.gaps',
          label: 'Coverage gaps',
          status: highGaps.length > 0 ? 'warn' : 'pass',
          message:
            highGaps.length > 0
              ? `${highGaps.length} high-priority coverage gaps remain.`
              : 'No high-priority coverage gaps detected.',
          actual: highGaps.length,
          expected: 0,
          details: highGaps.slice(0, 10).map((gap) => ({
            level: gap.level,
            stateCode: gap.stateCode,
            courtAlias: gap.courtAlias,
            code: gap.code,
            recommendedAction: gap.recommendedAction,
          })),
        },
      ] satisfies ReadinessCheck[]

      return readinessSection('coverage', 'Coverage Matrix', checks)
    } catch (error) {
      return readinessSection('coverage', 'Coverage Matrix', [
        {
          key: 'coverage.matrix',
          label: 'Coverage matrix',
          status: 'fail',
          message: `Coverage matrix failed: ${errorMessage(error)}`,
        },
      ])
    }
  }
}

function readinessReport(input: {
  now: DateTime
  tenant: Record<string, any> | null
  status: ReadinessStatus
  sections: ReadinessSection[]
}) {
  return {
    generatedAt: input.now.toISO(),
    status: input.status,
    tenant: input.tenant
      ? {
          id: String(input.tenant.id),
          slug: String(input.tenant.slug),
          name: String(input.tenant.name),
          status: String(input.tenant.status),
        }
      : null,
    summary: {
      sections: input.sections.length,
      passed: input.sections.filter((sectionItem) => sectionItem.status === 'pass').length,
      warnings: input.sections.filter((sectionItem) => sectionItem.status === 'warn').length,
      failures: input.sections.filter((sectionItem) => sectionItem.status === 'fail').length,
      checks: input.sections.reduce((total, sectionItem) => total + sectionItem.checks.length, 0),
    },
    sections: input.sections,
    nextActions: buildNextActions(input.sections),
  }
}

async function resolveTenant(options: BetaReadinessOptions) {
  const query = db.from('tenants').where('status', 'active')

  if (options.tenantId) {
    query.where('id', options.tenantId)
  } else {
    query.where('slug', options.tenantSlug ?? DEFAULT_TENANT_SLUG)
  }

  return query.first()
}

async function databaseCheck(): Promise<ReadinessCheck> {
  try {
    await db.rawQuery('select 1')
    return {
      key: 'database.connection',
      label: 'Database connection',
      status: 'pass',
      message: 'PostgreSQL connection is healthy.',
    }
  } catch (error) {
    return {
      key: 'database.connection',
      label: 'Database connection',
      status: 'fail',
      message: `PostgreSQL connection failed: ${errorMessage(error)}`,
    }
  }
}

async function countDefaultUsers() {
  const row = await db
    .from('users')
    .where('email', 'like', `%${DEFAULT_USER_DOMAIN}`)
    .where('status', 'active')
    .count('* as total')
    .first()

  return numberFrom(row)
}

async function activeMembershipCount(tenantId: string) {
  const row = await db
    .from('tenant_memberships')
    .where('tenant_id', tenantId)
    .where('status', 'active')
    .count('* as total')
    .first()

  return numberFrom(row)
}

async function defaultUserRoleCount(tenantId: string) {
  const row = await db
    .from('user_roles')
    .join('users', 'users.id', 'user_roles.user_id')
    .where('user_roles.tenant_id', tenantId)
    .where('users.email', 'like', `%${DEFAULT_USER_DOMAIN}`)
    .countDistinct('user_roles.role_id as total')
    .first()

  return numberFrom(row)
}

async function tableCount(tableName: string) {
  const row = await db.from(tableName).count('* as total').first()

  return numberFrom(row)
}

async function tenantTableCount(tableName: string, tenantId: string) {
  const row = await db.from(tableName).where('tenant_id', tenantId).count('* as total').first()

  return numberFrom(row)
}

async function latestCreatedAt(tableName: string, tenantId: string) {
  const columnName = EVIDENCE_LATEST_COLUMNS[tableName] ?? 'created_at'
  const row = await db
    .from(tableName)
    .where('tenant_id', tenantId)
    .max(`${columnName} as latest_created_at`)
    .first()

  return row?.latest_created_at ? dateIso(row.latest_created_at) : null
}

async function latestJobRunCheck(): Promise<ReadinessCheck> {
  const row = await db
    .from('radar_job_runs')
    .select('job_name', 'status', 'created_at', 'finished_at', 'error_code')
    .orderBy('created_at', 'desc')
    .first()

  return {
    key: 'jobs.latest_run',
    label: 'Latest job run',
    status: row ? 'pass' : 'warn',
    message: row
      ? `Latest job is ${row.job_name} with status ${row.status}.`
      : 'No job runs recorded yet; workers/scheduler have not processed anything.',
    actual: row ? String(row.status) : 0,
    expected: 'at least one completed or running job after boot',
    details: row
      ? {
          jobName: String(row.job_name),
          status: String(row.status),
          createdAt: dateIso(row.created_at),
          finishedAt: dateIso(row.finished_at),
          errorCode: row.error_code ? String(row.error_code) : null,
        }
      : null,
  }
}

async function latestAssetIntelligenceRunCheck(
  tenantId: string | null,
  now: DateTime
): Promise<ReadinessCheck> {
  if (!tenantId) {
    return {
      key: 'jobs.asset_intelligence_reconcile',
      label: 'Asset intelligence reconciliation',
      status: 'fail',
      message: 'Asset intelligence reconciliation cannot be checked without an active tenant.',
      expected: 'active beta tenant',
    }
  }

  const row = await db
    .from('radar_job_runs')
    .where('tenant_id', tenantId)
    .where('job_name', 'asset-intelligence-reconcile')
    .orderBy('created_at', 'desc')
    .first()

  if (!row) {
    return {
      key: 'jobs.asset_intelligence_reconcile',
      label: 'Asset intelligence reconciliation',
      status: 'warn',
      message: 'Asset intelligence reconciliation has not run yet.',
      actual: 0,
      expected: `completed within ${ASSET_INTELLIGENCE_RECONCILE_RECENT_SUCCESS_HOURS}h after worker boot`,
    }
  }

  const ageHours = dateAgeHours(row.created_at, now)
  const status = String(row.status)
  const isFreshSuccess =
    status === 'completed' && ageHours <= ASSET_INTELLIGENCE_RECONCILE_RECENT_SUCCESS_HOURS
  const isFreshRunning =
    status === 'running' && ageHours <= ASSET_INTELLIGENCE_RECONCILE_RUNNING_STALE_HOURS
  const checkStatus: ReadinessStatus =
    isFreshSuccess || isFreshRunning ? 'pass' : status === 'failed' ? 'fail' : 'warn'

  return {
    key: 'jobs.asset_intelligence_reconcile',
    label: 'Asset intelligence reconciliation',
    status: checkStatus,
    message:
      checkStatus === 'pass'
        ? `Asset intelligence reconciliation is ${status}.`
        : `Asset intelligence reconciliation latest status is ${status}.`,
    actual: status,
    expected: `completed within ${ASSET_INTELLIGENCE_RECONCILE_RECENT_SUCCESS_HOURS}h or running within ${ASSET_INTELLIGENCE_RECONCILE_RUNNING_STALE_HOURS}h`,
    details: {
      jobName: String(row.job_name),
      status,
      ageHours,
      createdAt: dateIso(row.created_at),
      finishedAt: dateIso(row.finished_at),
      errorCode: row.error_code ? String(row.error_code) : null,
      metrics: isRecord(row.metrics)
        ? {
            selectedAssets: row.metrics.selectedAssets ?? null,
            actedAssets: row.metrics.actedAssets ?? null,
            failedAssets: row.metrics.failedAssets ?? null,
            queuedActions: row.metrics.queuedActions ?? null,
            manualActions: row.metrics.manualActions ?? null,
          }
        : null,
    },
  }
}

function minimumCheck(
  key: string,
  label: string,
  actual: number,
  thresholds: {
    expected: number
    failBelow?: number
    warnBelow?: number
  }
): ReadinessCheck {
  const failBelow = thresholds.failBelow ?? 0
  const warnBelow = thresholds.warnBelow ?? thresholds.expected
  const status: ReadinessStatus = actual < failBelow ? 'fail' : actual < warnBelow ? 'warn' : 'pass'

  return {
    key,
    label,
    status,
    message:
      status === 'pass' ? `${label} is present.` : `${label} is below the expected baseline.`,
    actual,
    expected: thresholds.expected,
  }
}

function readinessSection(key: string, label: string, checks: ReadinessCheck[]): ReadinessSection {
  return {
    key,
    label,
    status: checksStatus(checks),
    checks,
  }
}

function checksStatus(checks: ReadinessCheck[]): ReadinessStatus {
  if (checks.some((check) => check.status === 'fail')) {
    return 'fail'
  }

  if (checks.some((check) => check.status === 'warn')) {
    return 'warn'
  }

  return 'pass'
}

function sectionStatus(sections: ReadinessSection[]): ReadinessStatus {
  if (sections.some((sectionItem) => sectionItem.status === 'fail')) {
    return 'fail'
  }

  if (sections.some((sectionItem) => sectionItem.status === 'warn')) {
    return 'warn'
  }

  return 'pass'
}

function buildNextActions(sections: ReadinessSection[]) {
  return sections
    .flatMap((sectionItem) =>
      sectionItem.checks
        .filter((check) => check.status !== 'pass')
        .map((check) => ({
          section: sectionItem.key,
          check: check.key,
          severity: check.status,
          action: actionFor(check.key),
        }))
    )
    .slice(0, 20)
}

function actionFor(key: string) {
  if (key.startsWith('data.')) {
    return 'Run node ace government:sync-data --tenant-id <tenant-id> --run-inline with conservative limits, then let scheduler continue.'
  }

  if (key.startsWith('queues.') || key.startsWith('workers.')) {
    return 'Start the worker process and verify Redis connectivity before opening beta traffic.'
  }

  if (key === 'jobs.asset_intelligence_reconcile') {
    return 'Start workers/scheduler or run node ace operations:reconcile-intelligence --tenant-id <tenant-id> --dry-run to inspect recommended actions.'
  }

  if (key.startsWith('coverage.')) {
    return 'Run node ace government:sync-data --tenant-id <tenant-id> --dry-run --run-inline to inspect the next coverage plan.'
  }

  if (key.startsWith('sources.')) {
    return 'Run migrations from a clean database and verify government source target bootstrap rows.'
  }

  return 'Review the failed bootstrap check before enabling beta users.'
}

function numberFrom(row: Record<string, any> | null | undefined) {
  return Number(row?.total ?? 0)
}

function dateIso(value: unknown) {
  if (!value) {
    return null
  }

  return DateTime.fromJSDate(value instanceof Date ? value : new Date(String(value))).toISO()
}

function dateAgeHours(value: unknown, now: DateTime) {
  if (!value) {
    return Number.POSITIVE_INFINITY
  }

  return Number(
    now
      .diff(DateTime.fromJSDate(new Date(value as string | number | Date)), 'hours')
      .hours.toFixed(2)
  )
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export default new BetaReadinessService()
