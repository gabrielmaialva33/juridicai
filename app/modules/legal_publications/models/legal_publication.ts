import { DateTime } from 'luxon'
import { belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import TenantModel from '#shared/models/tenant_model'
import type { JsonRecord } from '#shared/types/model_enums'
import Tenant from '#modules/tenant/models/tenant'
import User from '#modules/auth/models/user'
import PrecatorioAsset from '#modules/precatorios/models/precatorio_asset'
import JudicialProcess from '#modules/precatorios/models/judicial_process'
import MonitoredCase from '#modules/legal_publications/models/monitored_case'
import MonitoredBarRegistration from '#modules/legal_publications/models/monitored_bar_registration'
import LegalPublicationEvent from '#modules/legal_publications/models/legal_publication_event'

export type LegalPublicationOrigin = 'monitored_case' | 'bar_registration'
export type LegalPublicationStatus = 'new' | 'confirmed' | 'dismissed'
export type DeadlineKind = 'business_days' | 'calendar_days'

export default class LegalPublication extends TenantModel {
  @column()
  declare judicialProcessId: string | null

  @column()
  declare precatorioAssetId: string | null

  @column()
  declare monitoredCaseId: string | null

  @column()
  declare monitoredBarRegistrationId: string | null

  @column()
  declare djenId: string

  @column()
  declare processNumber: string

  @column()
  declare courtAlias: string | null

  @column()
  declare communicationType: string | null

  @column()
  declare courtBody: string | null

  @column()
  declare judicialClass: string | null

  @column()
  declare link: string | null

  @column()
  declare matchedBarRegistration: string | null

  @column()
  declare origin: LegalPublicationOrigin

  @column()
  declare body: string

  @column()
  declare textHash: string | null

  @column()
  declare rawData: JsonRecord | null

  @column.date()
  declare availableAt: DateTime | null

  @column.date()
  declare publishedAt: DateTime | null

  @column()
  declare determination: string | null

  @column()
  declare branch: string | null

  @column()
  declare actType: string | null

  @column()
  declare recommendedAction: string | null

  @column()
  declare legalBasis: string | null

  @column()
  declare deadlineDays: number | null

  @column()
  declare deadlineKind: DeadlineKind | null

  @column()
  declare deadlineItems: JsonRecord[] | null

  @column()
  declare labels: string[] | null

  @column.date()
  declare hearingAt: DateTime | null

  @column()
  declare hearingTime: string | null

  @column.date()
  declare judgmentAt: DateTime | null

  @column()
  declare priority: string | null

  @column()
  declare confidence: string | null

  @column()
  declare notes: string | null

  @column.date()
  declare dueAt: DateTime | null

  @column()
  declare overdue: boolean

  @column()
  declare businessDaysUntilHearing: number | null

  @column()
  declare hearingElapsed: boolean

  @column()
  declare partialCalendar: boolean

  @column()
  declare manualReviewRequired: boolean

  @column()
  declare deadlineReason: string | null

  @column()
  declare validatorFailed: boolean

  @column()
  declare validatorReason: string | null

  @column()
  declare status: LegalPublicationStatus

  @column.date()
  declare manualDueAt: DateTime | null

  @column()
  declare confirmedByUserId: string | null

  @column.dateTime()
  declare confirmedAt: DateTime | null

  @column.dateTime()
  declare processedAt: DateTime | null

  @column.dateTime()
  declare interpretationRequestedAt: DateTime | null

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => JudicialProcess)
  declare judicialProcess: BelongsTo<typeof JudicialProcess>

  @belongsTo(() => PrecatorioAsset, {
    foreignKey: 'precatorioAssetId',
  })
  declare precatorioAsset: BelongsTo<typeof PrecatorioAsset>

  @belongsTo(() => MonitoredCase)
  declare monitoredCase: BelongsTo<typeof MonitoredCase>

  @belongsTo(() => MonitoredBarRegistration)
  declare monitoredBarRegistration: BelongsTo<typeof MonitoredBarRegistration>

  @belongsTo(() => User, {
    foreignKey: 'confirmedByUserId',
  })
  declare confirmedByUser: BelongsTo<typeof User>

  @hasMany(() => LegalPublicationEvent)
  declare events: HasMany<typeof LegalPublicationEvent>
}
