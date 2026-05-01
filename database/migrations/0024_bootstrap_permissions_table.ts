import { BaseSchema } from '@adonisjs/lucid/schema'

const PERMISSIONS = [
  ['dashboard.read', 'Dashboard Read', 'View dashboard metrics and aggregates.'],
  ['imports.read', 'Imports Read', 'View SIOP import history and row status.'],
  ['imports.manage', 'Imports Manage', 'Upload and manage SIOP import jobs.'],
  ['precatorios.read', 'Precatorios Read', 'View precatorio assets and related public data.'],
  ['debtors.read', 'Debtors Read', 'View debtor profiles and payment context.'],
  ['pii.reveal', 'Pii Reveal', 'Reveal protected beneficiary data through the audited PII flow.'],
  ['exports.manage', 'Exports Manage', 'Create and inspect export jobs.'],
  [
    'integrations.datajud.read',
    'Integrations Datajud Read',
    'View DataJud enrichment and candidate matching data.',
  ],
  [
    'integrations.datajud.manage',
    'Integrations Datajud Manage',
    'Review and promote DataJud process match candidates.',
  ],
  [
    'operations.read',
    'Operations Read',
    'View cession desk, opportunity inbox, pricing, and pipeline APIs.',
  ],
  [
    'operations.manage',
    'Operations Manage',
    'Move cession opportunities through the operational pipeline.',
  ],
  ['market.read', 'Market Read', 'View CDI, Selic, IPCA, and EC 136 correction assumptions.'],
  ['market.manage', 'Market Manage', 'Sync and maintain market rate curves.'],
  ['admin.health.read', 'Admin Health Read', 'View healthcheck and service status.'],
  ['admin.jobs.read', 'Admin Jobs Read', 'View Radar job runs and worker activity.'],
] as const

export default class extends BaseSchema {
  async up() {
    for (const [slug, name, description] of PERMISSIONS) {
      await this.db
        .table('permissions')
        .insert({ slug, name, description })
        .onConflict('slug')
        .merge({ name, description, updated_at: this.raw('now()') })
    }
  }

  async down() {
    await this.db
      .from('permissions')
      .whereIn(
        'slug',
        PERMISSIONS.map(([slug]) => slug)
      )
      .delete()
  }
}
