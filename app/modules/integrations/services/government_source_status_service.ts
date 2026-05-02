import db from '@adonisjs/lucid/services/db'
import RadarJobRun from '#modules/admin/models/radar_job_run'
import GovernmentSourceTarget from '#modules/integrations/models/government_source_target'
import SourceDataset from '#modules/integrations/models/source_dataset'

export type GovernmentSourceStatus = {
  id: string
  key: string
  name: string
  owner: string | null
  level: string
  source: string
  priority: string
  status: string
  cadence: string | null
  courtAlias: string | null
  stateCode: string | null
  format: string | null
  sourceUrl: string | null
  manualExportUrl: string | null
  blockedLinks: string[]
  coverageScore: string | null
  lastSuccessAt: string | null
  lastErrorAt: string | null
  lastErrorMessage: string | null
  lastDiscoveredCount: number
  lastSourceRecordsCount: number
  tenantSourceRecordsCount: number
  tenantLastCollectedAt: unknown
  adapterKey: string | null
  lastJobRunAt: unknown
}

class GovernmentSourceStatusService {
  async listSources(tenantId: string): Promise<GovernmentSourceStatus[]> {
    const [targets, datasets, sourceRecordCounts, lastRuns] = await Promise.all([
      GovernmentSourceTarget.query()
        .preload('sourceDataset')
        .where('is_active', true)
        .orderBy('priority', 'asc')
        .orderBy('name', 'asc'),
      SourceDataset.query()
        .where('is_active', true)
        .orderBy('priority', 'asc')
        .orderBy('name', 'asc'),
      db
        .from('source_records')
        .select('source_dataset_id')
        .count('* as records_count')
        .max('collected_at as last_collected_at')
        .where('tenant_id', tenantId)
        .whereNotNull('source_dataset_id')
        .groupBy('source_dataset_id'),
      RadarJobRun.query()
        .select('job_name')
        .max('created_at as last_created_at')
        .where('tenant_id', tenantId)
        .groupBy('job_name'),
    ])
    const countsByDataset = new Map(
      sourceRecordCounts.map((row) => [
        String(row.source_dataset_id),
        {
          recordsCount: Number(row.records_count ?? 0),
          lastCollectedAt: row.last_collected_at,
        },
      ])
    )
    const lastRunByJob = new Map(
      lastRuns.map((row) => [
        String(row.$extras.job_name ?? row.jobName),
        {
          lastRunAt: row.$extras.last_created_at,
        },
      ])
    )
    const targetDatasetIds = new Set(targets.map((target) => target.sourceDatasetId))
    const sourceTargets = targets.map((target) => {
      const sourceUrl = target.sourceUrl ?? target.sourceDataset.baseUrl
      const metadata = target.metadata ?? target.sourceDataset.metadata ?? {}
      const counts = countsByDataset.get(target.sourceDatasetId)

      return {
        id: target.id,
        key: target.key,
        name: target.name,
        owner: target.sourceDataset.owner,
        level: target.federativeLevel,
        source: target.source,
        priority: target.priority,
        status: target.status,
        cadence: target.cadence,
        courtAlias: target.courtAlias,
        stateCode: target.stateCode,
        format: target.sourceFormat ?? target.sourceDataset.format,
        sourceUrl,
        manualExportUrl: stringFrom(metadata.manualExportUrl),
        blockedLinks: stringArrayFrom(metadata.blockedLinks),
        coverageScore: target.coverageScore,
        lastSuccessAt: target.lastSuccessAt?.toISO() ?? null,
        lastErrorAt: target.lastErrorAt?.toISO() ?? null,
        lastErrorMessage: target.lastErrorMessage,
        lastDiscoveredCount: target.lastDiscoveredCount,
        lastSourceRecordsCount: target.lastSourceRecordsCount,
        tenantSourceRecordsCount: counts?.recordsCount ?? 0,
        tenantLastCollectedAt: counts?.lastCollectedAt ?? null,
        adapterKey: target.adapterKey,
        lastJobRunAt: lastRunByJob.get(jobNameForTarget(target.adapterKey))?.lastRunAt ?? null,
      }
    })
    const datasetOnlySources = datasets
      .filter((dataset) => !targetDatasetIds.has(dataset.id))
      .map((dataset) => {
        const counts = countsByDataset.get(dataset.id)

        return {
          id: dataset.id,
          key: dataset.key,
          name: dataset.name,
          owner: dataset.owner,
          level: dataset.federativeLevel,
          source: dataset.source,
          priority: dataset.priority,
          status: 'pending',
          cadence: null,
          courtAlias: dataset.courtAlias,
          stateCode: dataset.stateCode,
          format: dataset.format,
          sourceUrl: dataset.baseUrl,
          manualExportUrl: stringFrom(dataset.metadata?.manualExportUrl),
          blockedLinks: stringArrayFrom(dataset.metadata?.blockedLinks),
          coverageScore: null,
          lastSuccessAt: null,
          lastErrorAt: null,
          lastErrorMessage: null,
          lastDiscoveredCount: 0,
          lastSourceRecordsCount: 0,
          tenantSourceRecordsCount: counts?.recordsCount ?? 0,
          tenantLastCollectedAt: counts?.lastCollectedAt ?? null,
          adapterKey: null,
          lastJobRunAt: null,
        }
      })

    return [...sourceTargets, ...datasetOnlySources]
  }

  async coverageMap(tenantId: string) {
    const sources = await this.listSources(tenantId)
    const groups = new Map<string, GovernmentCoverageGroup>()

    for (const source of sources) {
      const key = coverageKey(source)
      const current = groups.get(key) ?? emptyCoverageGroup(source, key)

      current.sourcesCount += 1
      current.sourceRecordsCount += source.tenantSourceRecordsCount
      current.discoveredCount += source.lastDiscoveredCount
      current.importedSourceRecordsCount += source.lastSourceRecordsCount

      if (source.tenantSourceRecordsCount > 0 || source.lastSuccessAt) {
        current.coveredSourcesCount += 1
      }

      if (source.status === 'blocked' || source.blockedLinks.length > 0 || source.manualExportUrl) {
        current.manualOrBlockedSourcesCount += 1
      }

      if (source.lastErrorAt || source.status === 'error') {
        current.errorSourcesCount += 1
      }

      current.sources.push(source)
      groups.set(key, current)
    }

    const items = [...groups.values()].sort((left, right) => {
      const stateCompare = (left.stateCode ?? '').localeCompare(right.stateCode ?? '')
      return stateCompare !== 0 ? stateCompare : left.name.localeCompare(right.name)
    })

    return {
      summary: {
        sourcesCount: sources.length,
        groupsCount: items.length,
        coveredGroupsCount: items.filter((item) => item.coveredSourcesCount > 0).length,
        manualOrBlockedGroupsCount: items.filter((item) => item.manualOrBlockedSourcesCount > 0)
          .length,
        errorGroupsCount: items.filter((item) => item.errorSourcesCount > 0).length,
        sourceRecordsCount: items.reduce((sum, item) => sum + item.sourceRecordsCount, 0),
        discoveredCount: items.reduce((sum, item) => sum + item.discoveredCount, 0),
      },
      items,
    }
  }
}

type GovernmentCoverageGroup = {
  key: string
  name: string
  level: string
  stateCode: string | null
  courtAlias: string | null
  sourcesCount: number
  coveredSourcesCount: number
  manualOrBlockedSourcesCount: number
  errorSourcesCount: number
  sourceRecordsCount: number
  discoveredCount: number
  importedSourceRecordsCount: number
  sources: GovernmentSourceStatus[]
}

function emptyCoverageGroup(source: GovernmentSourceStatus, key: string): GovernmentCoverageGroup {
  return {
    key,
    name: source.courtAlias ?? source.stateCode ?? source.level,
    level: source.level,
    stateCode: source.stateCode,
    courtAlias: source.courtAlias,
    sourcesCount: 0,
    coveredSourcesCount: 0,
    manualOrBlockedSourcesCount: 0,
    errorSourcesCount: 0,
    sourceRecordsCount: 0,
    discoveredCount: 0,
    importedSourceRecordsCount: 0,
    sources: [],
  }
}

function coverageKey(source: GovernmentSourceStatus) {
  return [source.level, source.stateCode ?? 'BR', source.courtAlias ?? source.source].join(':')
}

function stringFrom(value: unknown) {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function stringArrayFrom(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function jobNameForTarget(adapterKey: string | null) {
  if (adapterKey === 'siop_open_data_sync') {
    return 'siop-open-data-sync'
  }

  if (adapterKey === 'tjsp_precatorio_sync') {
    return 'tjsp-precatorio-sync'
  }

  if (adapterKey?.includes('trf')) {
    return 'tribunal-source-sync'
  }

  return 'government-data-sync-orchestrator'
}

export default new GovernmentSourceStatusService()
