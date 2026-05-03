import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import governmentCoverageRecoveryPlanService from '#modules/integrations/services/government_coverage_recovery_plan_service'
import type {
  CoverageLayer,
  GovernmentCoverageMatrix,
} from '#modules/integrations/services/government_coverage_matrix_service'
import type { SourceDataQualitySummary } from '#modules/integrations/services/source_data_quality_service'

test.group('Government coverage recovery plan service', () => {
  test('prioritizes runnable targets by missing evidence, stale data and source quality', ({
    assert,
  }) => {
    const matrix: GovernmentCoverageMatrix = {
      generatedAt: DateTime.utc().toISO(),
      summary: {
        statesCount: 2,
        validatedStatesCount: 1,
        configuredStatesCount: 1,
        mappedStatesCount: 0,
        blockedStatesCount: 0,
        missingStatesCount: 0,
        dataJudStatesCount: 0,
        djenStatesCount: 0,
        federalPrimaryValidatedCount: 1,
      },
      states: [
        {
          stateCode: 'AC',
          courtAlias: 'tjac',
          overallStatus: 'configured',
          primary: layer({
            status: 'configured',
            targetKey: 'coverage-recovery:tjac',
            adapterKey: 'generic_tribunal_public_source_sync',
          }),
          datajud: emptyLayer(),
          djen: emptyLayer(),
          intelligence: {
            hasPrimaryDiscovery: true,
            hasProcessEnrichment: false,
            hasPublicationSignals: false,
            hasRealDataEvidence: false,
            readyForOperationalScoring: false,
          },
          nextActions: [],
        },
        {
          stateCode: 'SP',
          courtAlias: 'tjsp',
          overallStatus: 'validated',
          primary: layer({
            status: 'validated',
            targetKey: 'coverage-recovery:tjsp',
            adapterKey: 'tjsp_precatorio_sync',
            lastSuccessAt: DateTime.utc().minus({ days: 12 }).toISO(),
            tenantSourceRecordsCount: 10,
            quality: quality({
              score: 0.41,
              grade: 'D',
              importYield: 0.3,
              errorRate: 0.35,
              fieldCoverageAverage: 0.55,
            }),
          }),
          datajud: emptyLayer(),
          djen: emptyLayer(),
          intelligence: {
            hasPrimaryDiscovery: true,
            hasProcessEnrichment: false,
            hasPublicationSignals: false,
            hasRealDataEvidence: true,
            readyForOperationalScoring: false,
          },
          nextActions: [],
        },
      ],
      federal: [
        {
          courtAlias: 'trf1',
          overallStatus: 'validated',
          primary: layer({
            status: 'validated',
            targetKey: 'coverage-recovery:trf1',
            adapterKey: 'trf1_precatorio_sync',
            lastSuccessAt: DateTime.utc().minus({ days: 1 }).toISO(),
            tenantSourceRecordsCount: 100,
            quality: quality({
              score: 0.92,
              grade: 'A',
              importYield: 0.9,
              errorRate: 0,
              fieldCoverageAverage: 0.95,
            }),
          }),
          datajud: emptyLayer(),
          djen: emptyLayer(),
          nextActions: [],
        },
      ],
      gaps: [
        {
          level: 'state',
          stateCode: 'MG',
          courtAlias: 'tjmg',
          severity: 'high',
          code: 'primary_source_missing',
          message: 'Missing source',
          recommendedAction: 'Research source.',
        },
      ],
    }

    const plan = governmentCoverageRecoveryPlanService.build(matrix)

    assert.deepEqual(plan.executableTargetKeys, [
      'coverage-recovery:tjac',
      'coverage-recovery:tjsp',
      'coverage-recovery:trf1',
    ])
    assert.equal(plan.summary.executableTargetsCount, 3)
    assert.equal(plan.summary.criticalTargetsCount, 2)
    assert.equal(plan.summary.lowTargetsCount, 1)
    assert.equal(plan.summary.missingAdapterTargetsCount, 1)
    assert.equal(plan.targets[0].priority, 'critical')
    assert.includeMembers(plan.targets[0].reasons, [
      'configured_without_validated_run',
      'never_succeeded',
      'no_tenant_source_records',
      'quality_unknown',
    ])
    assert.includeMembers(plan.targets[1].reasons, [
      'stale_success',
      'quality_failed',
      'low_import_yield',
      'high_error_rate',
      'low_field_coverage',
    ])
    assert.equal(plan.targets[2].priority, 'low')
  })
})

function layer(input: {
  status: CoverageLayer['status']
  targetKey: string | null
  adapterKey: string | null
  lastSuccessAt?: string | null
  tenantSourceRecordsCount?: number
  quality?: SourceDataQualitySummary | null
}): CoverageLayer {
  return {
    status: input.status,
    targetKey: input.targetKey,
    targetName: input.targetKey,
    adapterKey: input.adapterKey,
    sourceUrl: 'https://example.test/source',
    sourceStatus: 'implemented',
    lastSuccessAt: input.lastSuccessAt ?? null,
    lastDiscoveredCount: input.tenantSourceRecordsCount ?? 0,
    lastSourceRecordsCount: input.tenantSourceRecordsCount ?? 0,
    tenantSourceRecordsCount: input.tenantSourceRecordsCount ?? 0,
    evidenceScore: 0,
    quality: input.quality ?? null,
    metadata: null,
  }
}

function emptyLayer(): CoverageLayer {
  return layer({
    status: 'missing',
    targetKey: null,
    adapterKey: null,
  })
}

function quality(input: {
  score: number
  grade: SourceDataQualitySummary['grade']
  importYield: number
  errorRate: number
  fieldCoverageAverage: number
}): SourceDataQualitySummary {
  return {
    score: input.score,
    grade: input.grade,
    totalRows: 100,
    validRows: 90,
    selectedRows: 90,
    importedRows: Math.round(90 * input.importYield),
    errorRows: Math.round(90 * input.errorRate),
    validRowCoverage: 0.9,
    importYield: input.importYield,
    errorRate: input.errorRate,
    fieldCoverage: {
      cnj: input.fieldCoverageAverage,
      value: input.fieldCoverageAverage,
      year: input.fieldCoverageAverage,
      debtor: input.fieldCoverageAverage,
      average: input.fieldCoverageAverage,
    },
  }
}
