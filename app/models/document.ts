import { DateTime } from 'luxon'
import { column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import TenantAwareModel from '#models/tenant_aware_model'
import Case from '#models/case'
import Client from '#models/client'
import User from '#models/user'

type DocumentType =
  | 'petition'
  | 'contract'
  | 'evidence'
  | 'judgment'
  | 'appeal'
  | 'power_of_attorney'
  | 'agreement'
  | 'report'
  | 'other'
type StorageProvider = 'local' | 's3' | 'gcs'
type AccessLevel = 'tenant' | 'case_team' | 'owner_only'

export default class Document extends TenantAwareModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: string

  @column()
  declare case_id: number | null

  @column()
  declare client_id: number | null

  @column()
  declare uploaded_by: number

  @column()
  declare title: string

  @column()
  declare description: string | null

  @column()
  declare document_type: DocumentType

  // Armazenamento
  @column()
  declare file_path: string

  @column()
  declare file_hash: string | null

  @column()
  declare file_size: number

  @column()
  declare mime_type: string

  @column()
  declare original_filename: string

  @column()
  declare storage_provider: StorageProvider

  // OCR
  @column()
  declare ocr_text: string | null

  @column()
  declare is_ocr_processed: boolean

  // Assinatura
  @column()
  declare is_signed: boolean

  @column({
    prepare: (value: Record<string, any> | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | null) => (value ? JSON.parse(value) : null),
  })
  declare signature_data: Record<string, any> | null

  // Controle de acesso
  @column()
  declare access_level: AccessLevel

  // Organização
  @column({
    prepare: (value: string[] | null) => (value ? `{${value.join(',')}}` : null),
    consume: (value: string | null) => {
      if (!value) return null
      return value.replace(/[{}]/g, '').split(',').filter(Boolean)
    },
  })
  declare tags: string[] | null

  @column()
  declare version: number

  @column()
  declare parent_document_id: number | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // Relationships
  @belongsTo(() => Case)
  declare case: BelongsTo<typeof Case>

  @belongsTo(() => Client)
  declare client: BelongsTo<typeof Client>

  @belongsTo(() => User, {
    foreignKey: 'uploaded_by',
  })
  declare uploader: BelongsTo<typeof User>

  /**
   * Helper: Get file extension
   */
  get file_extension(): string {
    return this.original_filename.split('.').pop() || ''
  }

  /**
   * Helper: Get file size in MB
   */
  get file_size_mb(): number {
    return Math.round((this.file_size / 1024 / 1024) * 100) / 100
  }

  /**
   * Helper: Check if is PDF
   */
  get is_pdf(): boolean {
    return this.mime_type === 'application/pdf'
  }
}
