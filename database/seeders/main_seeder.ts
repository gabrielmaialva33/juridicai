import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Permission from '#modules/permission/models/permission'
import Role from '#modules/permission/models/role'
import Tenant from '#modules/tenant/models/tenant'
import TenantMembership from '#modules/tenant/models/tenant_membership'
import User from '#modules/auth/models/user'
import UserRole from '#modules/permission/models/user_role'
import Debtor from '#modules/debtors/models/debtor'
import SourceRecord from '#modules/siop/models/source_record'
import SiopImport from '#modules/siop/models/siop_import'
import SiopStagingRow from '#modules/siop/models/siop_staging_row'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import AssetEvent from '#modules/precatorios/models/asset_event'
import AssetScore from '#modules/precatorios/models/asset_score'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import Publication from '#modules/precatorios/models/publication'
import PublicationEvent from '#modules/precatorios/models/publication_event'
import Beneficiary from '#modules/pii/models/beneficiary'
import AssetBeneficiary from '#modules/pii/models/asset_beneficiary'
import RadarJobRun from '#modules/admin/models/radar_job_run'
import ExportJob from '#modules/exports/models/export_job'
import { PERMISSIONS, ROLES } from '#modules/permission/seeders_data'
import type { LucidModel, ModelAttributes } from '@adonisjs/lucid/types/model'

type ModelPayload<Model extends LucidModel> = Partial<ModelAttributes<InstanceType<Model>>>

const SEED_PASSWORD = 'Juridicai!2026'

const permissionDescriptions: Record<(typeof PERMISSIONS)[number], string> = {
  'dashboard.read': 'View dashboard metrics and aggregates.',
  'imports.read': 'View SIOP import history and row status.',
  'imports.manage': 'Upload and manage SIOP import jobs.',
  'precatorios.read': 'View precatorio assets and related public data.',
  'debtors.read': 'View debtor profiles and payment context.',
  'pii.reveal': 'Reveal protected beneficiary data through the audited PII flow.',
  'exports.manage': 'Create and inspect export jobs.',
  'integrations.datajud.read': 'View DataJud enrichment and candidate matching data.',
  'integrations.datajud.manage': 'Review and promote DataJud process match candidates.',
  'operations.read': 'View cession desk, opportunity inbox, pricing, and pipeline APIs.',
  'operations.manage': 'Move cession opportunities through the operational pipeline.',
  'admin.health.read': 'View healthcheck and service status.',
  'admin.jobs.read': 'View Radar job runs and worker activity.',
}

const debtorSeeds = [
  {
    key: 'union-federal',
    name: 'União Federal',
    normalizedName: 'UNIAO FEDERAL',
    debtorType: 'union' as const,
    paymentRegime: 'federal_unique' as const,
    cnpj: '00394460000141',
    stateCode: 'DF',
    rclEstimate: '0',
    debtStockEstimate: '98500000000.00',
    paymentReliabilityScore: 92,
  },
  {
    key: 'inss',
    name: 'Instituto Nacional do Seguro Social',
    normalizedName: 'INSTITUTO NACIONAL DO SEGURO SOCIAL',
    debtorType: 'autarchy' as const,
    paymentRegime: 'federal_unique' as const,
    cnpj: '29979036000140',
    stateCode: 'DF',
    rclEstimate: '0',
    debtStockEstimate: '32100000000.00',
    paymentReliabilityScore: 88,
  },
  {
    key: 'dnit',
    name: 'Departamento Nacional de Infraestrutura de Transportes',
    normalizedName: 'DEPARTAMENTO NACIONAL DE INFRAESTRUTURA DE TRANSPORTES',
    debtorType: 'autarchy' as const,
    paymentRegime: 'federal_unique' as const,
    cnpj: '04892707000100',
    stateCode: 'DF',
    rclEstimate: '0',
    debtStockEstimate: '4200000000.00',
    paymentReliabilityScore: 81,
  },
  {
    key: 'funasa',
    name: 'Fundação Nacional de Saúde',
    normalizedName: 'FUNDACAO NACIONAL DE SAUDE',
    debtorType: 'foundation' as const,
    paymentRegime: 'federal_unique' as const,
    cnpj: '26989209000100',
    stateCode: 'DF',
    rclEstimate: '0',
    debtStockEstimate: '2800000000.00',
    paymentReliabilityScore: 76,
  },
]

const assetSeeds = [
  {
    externalId: 'SIOP-2024-000001',
    debtorKey: 'union-federal',
    cnjNumber: '0001234-56.2020.4.01.3400',
    originProcessNumber: '1000123-44.2019.4.01.3400',
    assetNumber: 'PRC-2024-000001',
    exerciseYear: 2024,
    budgetYear: 2025,
    nature: 'alimentar' as const,
    faceValue: '1350000.00',
    estimatedUpdatedValue: '1512000.00',
    baseDate: '2024-07-01',
    queuePosition: 118,
    lifecycleStatus: 'expedited' as const,
    piiStatus: 'bunker_available' as const,
    complianceStatus: 'approved_for_analysis' as const,
    score: 82,
  },
  {
    externalId: 'SIOP-2024-000002',
    debtorKey: 'inss',
    cnjNumber: '0002234-12.2021.4.03.6100',
    originProcessNumber: '5004321-18.2020.4.03.6100',
    assetNumber: 'PRC-2024-000002',
    exerciseYear: 2024,
    budgetYear: 2025,
    nature: 'alimentar' as const,
    faceValue: '820000.00',
    estimatedUpdatedValue: '904000.00',
    baseDate: '2024-08-15',
    queuePosition: 241,
    lifecycleStatus: 'pending' as const,
    piiStatus: 'pseudonymous' as const,
    complianceStatus: 'pending' as const,
    score: 71,
  },
  {
    externalId: 'SIOP-2023-000087',
    debtorKey: 'dnit',
    cnjNumber: '0009876-90.2018.4.01.3800',
    originProcessNumber: '0009876-90.2018.4.01.3800',
    assetNumber: 'PRC-2023-000087',
    exerciseYear: 2023,
    budgetYear: 2024,
    nature: 'comum' as const,
    faceValue: '2450000.00',
    estimatedUpdatedValue: '2785000.00',
    baseDate: '2023-10-20',
    queuePosition: 52,
    lifecycleStatus: 'in_payment' as const,
    piiStatus: 'none' as const,
    complianceStatus: 'approved_for_sales' as const,
    score: 89,
  },
  {
    externalId: 'SIOP-2022-000312',
    debtorKey: 'funasa',
    cnjNumber: '0012456-77.2017.4.05.8300',
    originProcessNumber: '0800123-33.2016.4.05.8300',
    assetNumber: 'PRC-2022-000312',
    exerciseYear: 2022,
    budgetYear: 2023,
    nature: 'comum' as const,
    faceValue: '610000.00',
    estimatedUpdatedValue: '702500.00',
    baseDate: '2022-12-05',
    queuePosition: 418,
    lifecycleStatus: 'paid' as const,
    piiStatus: 'bunker_available' as const,
    complianceStatus: 'approved_for_analysis' as const,
    score: 64,
  },
]

export default class extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    const permissions = await this.seedPermissions()
    const roles = await this.seedRoles(permissions)
    const tenant = await this.seedTenant()
    const users = await this.seedUsers()

    await this.seedMembershipsAndRoles(tenant, users, roles)
    await this.seedRetentionPolicy(tenant)
    await this.seedRadarDataset(tenant, users.owner)
  }

  private async seedPermissions() {
    const permissions = new Map<string, Permission>()

    for (const slug of PERMISSIONS) {
      const permission = await upsertModel(
        Permission,
        { slug },
        {
          name: titleize(slug),
          description: permissionDescriptions[slug],
        }
      )

      permissions.set(slug, permission)
    }

    return permissions
  }

  private async seedRoles(permissions: Map<string, Permission>) {
    const roles = new Map<string, Role>()

    for (const roleSeed of ROLES) {
      const role = await upsertModel(
        Role,
        { slug: roleSeed.slug },
        {
          name: roleSeed.name,
          description: `${roleSeed.name} role for the Radar Federal base workspace.`,
        }
      )

      for (const permissionSlug of roleSeed.permissions) {
        const permission = permissions.get(permissionSlug)
        if (!permission) {
          continue
        }

        await db
          .table('role_permissions')
          .insert({
            role_id: role.id,
            permission_id: permission.id,
            created_at: new Date(),
          })
          .onConflict(['role_id', 'permission_id'])
          .ignore()
      }

      roles.set(roleSeed.slug, role)
    }

    return roles
  }

  private async seedTenant() {
    return upsertModel(
      Tenant,
      { slug: 'benicio-capital' },
      {
        name: 'Benício Capital',
        document: '00000000000191',
        status: 'active',
        plan: 'radar-federal-pilot',
        rbacVersion: 1,
      }
    )
  }

  private async seedUsers() {
    const owner = await upsertModel(
      User,
      { email: 'owner@juridicai.local' },
      {
        fullName: 'Gabriel Maia',
        password: SEED_PASSWORD,
        status: 'active',
      }
    )

    const analyst = await upsertModel(
      User,
      { email: 'analyst@juridicai.local' },
      {
        fullName: 'Analista Radar',
        password: SEED_PASSWORD,
        status: 'active',
      }
    )

    return { owner, analyst }
  }

  private async seedMembershipsAndRoles(
    tenant: Tenant,
    users: { owner: User; analyst: User },
    roles: Map<string, Role>
  ) {
    await upsertModel(
      TenantMembership,
      { tenantId: tenant.id, userId: users.owner.id },
      { status: 'active' }
    )
    await upsertModel(
      TenantMembership,
      { tenantId: tenant.id, userId: users.analyst.id },
      { status: 'active' }
    )

    const ownerRole = roles.get('owner')
    const analystRole = roles.get('analyst')

    if (ownerRole) {
      await upsertModel(
        UserRole,
        { tenantId: tenant.id, userId: users.owner.id, roleId: ownerRole.id },
        {}
      )
    }

    if (analystRole) {
      await upsertModel(
        UserRole,
        { tenantId: tenant.id, userId: users.analyst.id, roleId: analystRole.id },
        {}
      )
    }
  }

  private async seedRetentionPolicy(tenant: Tenant) {
    const policies = [
      ['audit_logs', 2555],
      ['pii_access_logs', 2555],
      ['source_records', 3650],
      ['exports', 30],
      ['client_errors', 90],
    ] as const

    for (const [subject, retentionDays] of policies) {
      await db
        .table('retention_config')
        .insert({
          tenant_id: tenant.id,
          subject,
          retention_days: retentionDays,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .onConflict(['tenant_id', 'subject'])
        .merge({
          retention_days: retentionDays,
          enabled: true,
          updated_at: new Date(),
        })
    }
  }

  private async seedRadarDataset(tenant: Tenant, owner: User) {
    const debtors = await this.seedDebtors(tenant)
    const sources = await this.seedSourceRecords(tenant)
    const imports = await this.seedImports(tenant, owner, sources)

    await this.seedAssets(tenant, debtors, sources.get(2024) ?? sources.values().next().value)
    await this.seedOperationalRows(imports)
    await this.seedJobsAndExports(tenant, owner)
  }

  private async seedDebtors(tenant: Tenant) {
    const debtors = new Map<string, Debtor>()

    for (const seed of debtorSeeds) {
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

      debtors.set(seed.key, debtor)
    }

    return debtors
  }

  private async seedSourceRecords(tenant: Tenant) {
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

  private async seedImports(tenant: Tenant, owner: User, sources: Map<number, SourceRecord>) {
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

  private async seedAssets(
    tenant: Tenant,
    debtors: Map<string, Debtor>,
    sourceRecord: SourceRecord | undefined
  ) {
    if (!sourceRecord) {
      return
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

      await this.seedAssetTrail(tenant, asset, sourceRecord, seed.score)
    }
  }

  private async seedAssetTrail(
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

  private async seedOperationalRows(operations: Map<number, SiopImport>) {
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

  private async seedJobsAndExports(tenant: Tenant, owner: User) {
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
}

async function upsertModel<Model extends LucidModel>(
  model: Model,
  where: ModelPayload<Model>,
  payload: ModelPayload<Model>
): Promise<InstanceType<Model>> {
  const row = await model.query().where(where).first()

  if (row) {
    row.merge(payload)
    await row.save()
    return row as InstanceType<Model>
  }

  return model.create({ ...where, ...payload }) as Promise<InstanceType<Model>>
}

function stableHash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function titleize(slug: string) {
  return slug
    .split('.')
    .map((part) => part.replace(/_/g, ' '))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
