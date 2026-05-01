import { DateTime } from 'luxon'
import Debtor from '#modules/debtors/models/debtor'
import DebtorPaymentStat from '#modules/debtors/models/debtor_payment_stat'
import SourceRecord from '#modules/siop/models/source_record'
import SiopImport from '#modules/siop/models/siop_import'
import SiopStagingRow from '#modules/siop/models/siop_staging_row'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetScore from '#modules/precatorios/models/asset_score'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import Publication from '#modules/precatorios/models/publication'
import PublicationEvent from '#modules/precatorios/models/publication_event'
import CessionOpportunity from '#modules/operations/models/cession_opportunity'
import Beneficiary from '#modules/pii/models/beneficiary'
import AssetBeneficiary from '#modules/pii/models/asset_beneficiary'
import RadarJobRun from '#modules/admin/models/radar_job_run'
import ExportJob from '#modules/exports/models/export_job'
import type Tenant from '#modules/tenant/models/tenant'
import type User from '#modules/auth/models/user'
import { assetSeeds, cessionOpportunitySeeds, debtorSeeds } from './radar_seed_data.js'
import { stableHash, upsertModel } from './upsert.js'

export async function seedRadarDataset(tenant: Tenant, owner: User) {
  const debtors = await seedDebtors(tenant)
  const sources = await seedSourceRecords(tenant)
  const imports = await seedImports(tenant, owner, sources)

  const assets = await seedAssets(
    tenant,
    debtors,
    sources.get(2024) ?? sources.values().next().value
  )
  await seedCessionOpportunities(tenant, owner, assets)
  await seedOperationalRows(imports)
  await seedJobsAndExports(tenant, owner)
}

async function seedDebtors(tenant: Tenant) {
  const debtors = new Map<string, Debtor>()

  for (const seed of debtorSeeds) {
    const paymentRegime = seed.paymentRegime as string
    const debtor = await upsertModel(
      Debtor,
      { tenantId: tenant.id, normalizedKey: seed.key },
      {
        name: seed.name,
        normalizedName: seed.normalizedName,
        debtorType: seed.debtorType,
        cnpj: seed.cnpj,
        stateCode: seed.stateCode,
        paymentRegime: seed.paymentRegime,
        rclEstimate: seed.rclEstimate,
        debtStockEstimate: seed.debtStockEstimate,
        paymentReliabilityScore: seed.paymentReliabilityScore,
      }
    )

    await upsertModel(
      DebtorPaymentStat,
      {
        tenantId: tenant.id,
        debtorId: debtor.id,
        source: 'seed',
      },
      {
        periodStart: DateTime.fromISO('2021-01-01'),
        periodEnd: DateTime.fromISO('2025-12-31'),
        sampleSize: 128,
        averagePaymentMonths:
          paymentRegime === 'federal_unique' ? 16 : seed.paymentReliabilityScore > 80 ? 30 : 54,
        onTimePaymentRate: String(seed.paymentReliabilityScore / 100),
        paidVolume: '1250000000.00',
        openDebtStock: seed.debtStockEstimate,
        rclDebtRatio: seed.rclEstimate === '0' ? null : '0.038000',
        regimeSpecialActive: paymentRegime === 'special',
        recentDefault: seed.paymentReliabilityScore < 60,
        reliabilityScore: seed.paymentReliabilityScore,
        rawData: {
          seed: true,
        },
      }
    )

    debtors.set(seed.key, debtor)
  }

  return debtors
}

async function seedSourceRecords(tenant: Tenant) {
  const sources = new Map<number, SourceRecord>()

  for (const year of [2022, 2023, 2024]) {
    const checksum = stableHash(`siop-${year}-seed`)
    const source = await upsertModel(
      SourceRecord,
      {
        tenantId: tenant.id,
        source: 'siop',
        sourceChecksum: checksum,
      },
      {
        sourceUrl: `https://siop.gov.br/seed/precatorios-${year}.xlsx`,
        sourceFilePath: `seed/siop/precatorios-${year}.xlsx`,
        originalFilename: `precatorios-federais-${year}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileSizeBytes: 1_048_576 + year,
        collectedAt: DateTime.fromISO(`${year}-12-20T10:00:00.000Z`),
        rawData: {
          seed: true,
          year,
          source: 'SIOP federal public history',
        },
      }
    )

    sources.set(year, source)
  }

  return sources
}

async function seedImports(tenant: Tenant, owner: User, sources: Map<number, SourceRecord>) {
  const imports = new Map<number, SiopImport>()

  for (const [year, source] of sources) {
    const importRow = await upsertModel(
      SiopImport,
      {
        tenantId: tenant.id,
        source: 'siop',
        exerciseYear: year,
        sourceRecordId: source.id,
      },
      {
        status: 'completed',
        startedAt: DateTime.fromISO(`${year}-12-20T10:15:00.000Z`),
        finishedAt: DateTime.fromISO(`${year}-12-20T10:18:00.000Z`),
        totalRows: year === 2024 ? 12480 : year === 2023 ? 11942 : 10876,
        inserted: year === 2024 ? 4520 : year === 2023 ? 4310 : 3988,
        updated: year === 2024 ? 219 : year === 2023 ? 198 : 176,
        skipped: year === 2024 ? 7741 : year === 2023 ? 7434 : 6712,
        errors: year === 2024 ? 7 : year === 2023 ? 5 : 4,
        rawMetadata: {
          seed: true,
          parser: 'exceljs',
          sourceFilename: source.originalFilename,
        },
        uploadedByUserId: owner.id,
      }
    )

    imports.set(year, importRow)
  }

  return imports
}

async function seedAssets(
  tenant: Tenant,
  debtors: Map<string, Debtor>,
  sourceRecord: SourceRecord | undefined
) {
  const assets = new Map<string, PrecatorioAsset>()

  if (!sourceRecord) {
    return assets
  }

  for (const seed of assetSeeds) {
    const debtor = debtors.get(seed.debtorKey)
    if (!debtor) {
      continue
    }

    const asset = await upsertModel(
      PrecatorioAsset,
      {
        tenantId: tenant.id,
        source: 'siop',
        externalId: seed.externalId,
      },
      {
        sourceRecordId: sourceRecord.id,
        cnjNumber: seed.cnjNumber,
        originProcessNumber: seed.originProcessNumber,
        debtorId: debtor.id,
        assetNumber: seed.assetNumber,
        exerciseYear: seed.exerciseYear,
        budgetYear: seed.budgetYear,
        nature: seed.nature,
        faceValue: seed.faceValue,
        estimatedUpdatedValue: seed.estimatedUpdatedValue,
        baseDate: DateTime.fromISO(seed.baseDate),
        queuePosition: seed.queuePosition,
        lifecycleStatus: seed.lifecycleStatus,
        piiStatus: seed.piiStatus,
        complianceStatus: seed.complianceStatus,
        rawData: {
          seed: true,
          row: seed.externalId,
          debtor: debtor.name,
        },
        rowFingerprint: stableHash(`${tenant.id}:${seed.externalId}`),
      }
    )

    const score = await upsertModel(
      AssetScore,
      {
        tenantId: tenant.id,
        assetId: asset.id,
        scoreVersion: 'seed-v1',
      },
      {
        dataQualityScore: seed.score - 5,
        maturityScore: seed.score - 2,
        liquidityScore: seed.score,
        legalSignalScore: seed.score + 1,
        economicScore: seed.score - 3,
        riskScore: 100 - seed.score,
        finalScore: seed.score,
        explanation: {
          seed: true,
          signals: ['federal_debtor', 'siop_history', 'public_provenance'],
        },
        computedAt: DateTime.fromISO(`${seed.exerciseYear}-12-22T12:00:00.000Z`),
      }
    )

    asset.merge({
      currentScore: score.finalScore,
      currentScoreId: score.id,
    })
    await asset.save()

    await seedAssetTrail(tenant, asset, sourceRecord, seed.score)
    assets.set(seed.externalId, asset)
  }

  return assets
}

async function seedAssetTrail(
  tenant: Tenant,
  asset: PrecatorioAsset,
  sourceRecord: SourceRecord,
  score: number
) {
  const exerciseYear = asset.exerciseYear ?? DateTime.now().year

  await upsertModel(
    AssetEvent,
    {
      tenantId: tenant.id,
      assetId: asset.id,
      eventType: 'siop_imported',
      idempotencyKey: `seed:${asset.externalId}:imported`,
    },
    {
      eventDate: DateTime.fromISO(`${exerciseYear}-12-20T10:20:00.000Z`),
      source: 'siop',
      payload: {
        sourceRecordId: sourceRecord.id,
        externalId: asset.externalId,
      },
    }
  )

  const seed = assetSeeds.find((item) => item.externalId === asset.externalId)
  const signalEvents = seed?.signalEvents ?? []

  for (const [index, eventType] of signalEvents.entries()) {
    await upsertModel(
      AssetEvent,
      {
        tenantId: tenant.id,
        assetId: asset.id,
        eventType,
        idempotencyKey: `seed:${asset.externalId}:${eventType}`,
      },
      {
        eventDate: DateTime.now().minus({ hours: index + 1 }),
        source: 'manual',
        payload: {
          seed: true,
          betaScenario: true,
          eventType,
        },
      }
    )
  }

  await upsertModel(
    AssetEvent,
    {
      tenantId: tenant.id,
      assetId: asset.id,
      eventType: 'score_computed',
      idempotencyKey: `seed:${asset.externalId}:score`,
    },
    {
      eventDate: DateTime.fromISO(`${exerciseYear}-12-22T12:00:00.000Z`),
      source: 'manual',
      payload: {
        score,
        version: 'seed-v1',
      },
    }
  )

  const process = await upsertModel(
    JudicialProcess,
    {
      tenantId: tenant.id,
      cnjNumber: asset.cnjNumber ?? asset.externalId ?? asset.id,
    },
    {
      assetId: asset.id,
      sourceRecordId: sourceRecord.id,
      source: 'siop',
      courtCode: 'TRF1',
      courtName: 'Tribunal Regional Federal da 1ª Região',
      className: 'Requisição de Pagamento',
      subject: 'Precatório federal',
      filedAt: DateTime.fromISO(`${exerciseYear - 3}-04-12`),
      rawData: {
        seed: true,
      },
    }
  )

  const publication = await upsertModel(
    Publication,
    {
      tenantId: tenant.id,
      source: 'siop',
      textHash: stableHash(`publication:${asset.externalId}`),
      publicationDate: DateTime.fromISO(`${exerciseYear}-11-18`),
    },
    {
      assetId: asset.id,
      processId: process.id,
      sourceRecordId: sourceRecord.id,
      title: `Autuação de precatório ${asset.assetNumber}`,
      body: `Registro público de precatório federal vinculado ao processo ${asset.cnjNumber}.`,
      rawData: {
        seed: true,
      },
    }
  )

  await upsertModel(
    PublicationEvent,
    {
      tenantId: tenant.id,
      publicationId: publication.id,
      eventType: 'published',
    },
    {
      eventDate: DateTime.fromISO(`${exerciseYear}-11-18T09:00:00.000Z`),
      payload: {
        seed: true,
        source: 'siop',
      },
    }
  )

  if (asset.piiStatus !== 'none') {
    const beneficiary = await upsertModel(
      Beneficiary,
      {
        tenantId: tenant.id,
        beneficiaryHash: stableHash(`beneficiary:${asset.externalId}`),
      },
      {
        status: asset.piiStatus === 'pseudonymous' ? 'pseudonymous' : 'bunker_available',
        legalBasis: 'legitimate_interest_public_judicial_asset_analysis',
        rawMetadata: {
          seed: true,
          source: 'SIOP seed placeholder',
        },
      }
    )

    await upsertModel(
      AssetBeneficiary,
      {
        tenantId: tenant.id,
        assetId: asset.id,
        beneficiaryId: beneficiary.id,
      },
      {
        relationshipType: 'beneficiary',
        sharePercent: '100.0000',
      }
    )
  }
}

async function seedCessionOpportunities(
  tenant: Tenant,
  owner: User,
  assets: Map<string, PrecatorioAsset>
) {
  for (const seed of cessionOpportunitySeeds) {
    const asset = assets.get(seed.externalId)
    if (!asset) {
      continue
    }

    await upsertModel(
      CessionOpportunity,
      {
        tenantId: tenant.id,
        assetId: asset.id,
      },
      {
        stage: seed.stage,
        offerRate: seed.offerRate,
        offerValue: String(Number(asset.faceValue ?? 0) * Number(seed.offerRate)),
        termMonths: seed.termMonths,
        priority: seed.priority,
        targetCloseAt:
          seed.targetCloseDays === null
            ? null
            : DateTime.now().plus({ days: seed.targetCloseDays }),
        lastContactedAt: DateTime.now().minus({ days: seed.lastContactDays }),
        notes: seed.notes,
        metadata: {
          seed: true,
          betaScenario: true,
        },
        createdByUserId: owner.id,
        updatedByUserId: owner.id,
      }
    )
  }
}

async function seedOperationalRows(operations: Map<number, SiopImport>) {
  for (const [year, operation] of operations) {
    await upsertModel(
      SiopStagingRow,
      {
        importId: operation.id,
        normalizedCnj: `seed-${year}-valid`,
      },
      {
        rawData: {
          seed: true,
          year,
          rowType: 'valid',
        },
        normalizedDebtorKey: 'union-federal',
        normalizedValue: '1350000.00',
        normalizedYear: year,
        validationStatus: 'valid',
        errors: { messages: [] },
        processedAt: DateTime.fromISO(`${year}-12-20T10:16:00.000Z`),
      }
    )

    await upsertModel(
      SiopStagingRow,
      {
        importId: operation.id,
        normalizedCnj: `seed-${year}-warning`,
      },
      {
        rawData: {
          seed: true,
          year,
          rowType: 'warning',
        },
        normalizedDebtorKey: 'inss',
        normalizedValue: '820000.00',
        normalizedYear: year,
        validationStatus: 'warning',
        errors: {
          messages: ['Missing optional queue position in original file.'],
        },
        processedAt: DateTime.fromISO(`${year}-12-20T10:17:00.000Z`),
      }
    )
  }
}

async function seedJobsAndExports(tenant: Tenant, owner: User) {
  await upsertModel(
    RadarJobRun,
    {
      tenantId: tenant.id,
      jobName: 'siop.import.seed',
    },
    {
      queueName: 'siop-imports',
      bullmqJobId: 'seed-job-siop-import',
      status: 'completed',
      origin: 'system',
      startedAt: DateTime.now().minus({ minutes: 12 }),
      finishedAt: DateTime.now().minus({ minutes: 10 }),
      durationMs: 120000,
      attempts: 1,
      metrics: {
        files: 3,
        rows: 353_000,
      },
      metadata: {
        seed: true,
      },
    }
  )

  await upsertModel(
    ExportJob,
    {
      tenantId: tenant.id,
      exportType: 'precatorios_csv_seed',
    },
    {
      requestedByUserId: owner.id,
      status: 'completed',
      filters: {
        lifecycleStatus: ['pending', 'in_payment', 'expedited'],
      },
      filePath: 'seed/exports/precatorios-demo.csv',
      errorMessage: null,
      expiresAt: DateTime.now().plus({ days: 7 }),
    }
  )
}
