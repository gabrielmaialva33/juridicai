import { DateTime } from 'luxon'
import {
  BaseModel,
  belongsTo,
  column,
  computed,
  scope,
  SnakeCaseNamingStrategy,
} from '@adonisjs/lucid/orm'
import { compose } from '@adonisjs/core/helpers'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

import { withTenantScope } from '#mixins/with_tenant_scope'
import Case from '#models/case'
import Client from '#models/client'
import User from '#models/user'

type Builder = ModelQueryBuilderContract<typeof Document>

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

// Create the tenant-scoped mixin
const TenantScoped = withTenantScope()

export default class Document extends compose(BaseModel, TenantScoped) {
  static table = 'documents'
  static namingStrategy = new SnakeCaseNamingStrategy()

  /**
   * ------------------------------------------------------
   * Columns
   * ------------------------------------------------------
   */
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

  @column()
  declare ocr_text: string | null

  @column()
  declare is_ocr_processed: boolean

  @column()
  declare is_signed: boolean

  @column({
    prepare: (value: Record<string, any> | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | null) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare signature_data: Record<string, any> | null

  @column()
  declare access_level: AccessLevel

  @column({
    prepare: (value: string[] | null) => (value ? `{${value.join(',')}}` : null),
    consume: (value: string | string[] | null) => {
      if (!value) return null
      // PostgreSQL returns arrays as JavaScript arrays directly
      if (Array.isArray(value)) return value
      // But in some cases it might be a string: {tag1,tag2,tag3}
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

  /**
   * ------------------------------------------------------
   * Relationships
   * ------------------------------------------------------
   */
  @belongsTo(() => Case, {
    foreignKey: 'case_id',
  })
  declare case: BelongsTo<typeof Case>

  @belongsTo(() => Client, {
    foreignKey: 'client_id',
  })
  declare client: BelongsTo<typeof Client>

  @belongsTo(() => User, {
    foreignKey: 'uploaded_by',
  })
  declare uploader: BelongsTo<typeof User>

  /**
   * ------------------------------------------------------
   * Hooks
   * ------------------------------------------------------
   */

  /**
   * ------------------------------------------------------
   * Query Scopes
   * ------------------------------------------------------
   */

  /**
   * Search documents by title, description or OCR text
   * @example Document.query().withScopes((scopes) => scopes.search('contract'))
   */
  static search = scope((query, term: string) => {
    if (!term || !term.trim()) return query

    const searchTerm = `%${term.trim()}%`
    return query.where((builder) => {
      builder
        .whereILike('title', searchTerm)
        .orWhereILike('description', searchTerm)
        .orWhereILike('original_filename', searchTerm)
        .orWhereILike('ocr_text', searchTerm)
    })
  })

  /**
   * Filter documents by type
   * @example Document.query().withScopes((scopes) => scopes.byType('contract'))
   */
  static byType = scope((query, type: DocumentType) => {
    return query.where('document_type', type)
  })

  /**
   * Filter documents by multiple types
   * @example Document.query().withScopes((scopes) => scopes.byTypes(['contract', 'agreement']))
   */
  static byTypes = scope((query, types: DocumentType[]) => {
    return query.whereIn('document_type', types)
  })

  /**
   * Filter documents for a specific case
   * @example Document.query().withScopes((scopes) => scopes.forCase(caseId))
   */
  static forCase = scope((query, caseId: number) => {
    return query.where('case_id', caseId)
  })

  /**
   * Filter documents for a specific client
   * @example Document.query().withScopes((scopes) => scopes.forClient(clientId))
   */
  static forClient = scope((query, clientId: number) => {
    return query.where('client_id', clientId)
  })

  /**
   * Filter documents without case association
   * @example Document.query().withScopes((scopes) => scopes.withoutCase())
   */
  static withoutCase = scope((query: Builder) => {
    return query.whereNull('case_id')
  })

  /**
   * Filter signed documents
   * @example Document.query().withScopes((scopes) => scopes.signed())
   */
  static signed = scope((query: Builder) => {
    return query.where('is_signed', true)
  })

  /**
   * Filter unsigned documents
   * @example Document.query().withScopes((scopes) => scopes.unsigned())
   */
  static unsigned = scope((query: Builder) => {
    return query.where('is_signed', false)
  })

  /**
   * Filter documents with OCR processing
   * @example Document.query().withScopes((scopes) => scopes.ocrProcessed())
   */
  static ocrProcessed = scope((query: Builder) => {
    return query.where('is_ocr_processed', true)
  })

  /**
   * Filter documents pending OCR processing
   * @example Document.query().withScopes((scopes) => scopes.pendingOcr())
   */
  static pendingOcr = scope((query: Builder) => {
    return query.where('is_ocr_processed', false)
  })

  /**
   * Filter documents by access level
   * @example Document.query().withScopes((scopes) => scopes.byAccessLevel('tenant'))
   */
  static byAccessLevel = scope((query, level: AccessLevel) => {
    return query.where('access_level', level)
  })

  /**
   * Filter documents uploaded by specific user
   * @example Document.query().withScopes((scopes) => scopes.uploadedBy(userId))
   */
  static uploadedBy = scope((query, userId: number) => {
    return query.where('uploaded_by', userId)
  })

  /**
   * Filter documents by mime type
   * @example Document.query().withScopes((scopes) => scopes.byMimeType('application/pdf'))
   */
  static byMimeType = scope((query, mimeType: string) => {
    return query.where('mime_type', mimeType)
  })

  /**
   * Filter PDF documents
   * @example Document.query().withScopes((scopes) => scopes.pdfs())
   */
  static pdfs = scope((query: Builder) => {
    return query.where('mime_type', 'application/pdf')
  })

  /**
   * Filter image documents
   * @example Document.query().withScopes((scopes) => scopes.images())
   */
  static images = scope((query: Builder) => {
    return query.whereIn('mime_type', [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ])
  })

  /**
   * Filter documents by file size range (in bytes)
   * @example Document.query().withScopes((scopes) => scopes.sizeBetween(0, 5242880)) // 0-5MB
   */
  static sizeBetween = scope((query, minSize: number, maxSize: number) => {
    return query.whereBetween('file_size', [minSize, maxSize])
  })

  /**
   * Filter large documents (>10MB)
   * @example Document.query().withScopes((scopes) => scopes.largeFiles())
   */
  static largeFiles = scope((query: Builder) => {
    return query.where('file_size', '>', 10 * 1024 * 1024)
  })

  /**
   * Filter documents with specific tag
   * @example Document.query().withScopes((scopes) => scopes.hasTag('important'))
   */
  static hasTag = scope((query, tag: string) => {
    return query.whereRaw('? = ANY(tags)', [tag])
  })

  /**
   * Filter documents with any of the tags
   * @example Document.query().withScopes((scopes) => scopes.hasAnyTag(['important', 'urgent']))
   */
  static hasAnyTag = scope((query, tags: string[]) => {
    return query.whereRaw('tags && ?', [`{${tags.join(',')}}`])
  })

  /**
   * Filter by storage provider
   * @example Document.query().withScopes((scopes) => scopes.byStorage('s3'))
   */
  static byStorage = scope((query, provider: StorageProvider) => {
    return query.where('storage_provider', provider)
  })

  /**
   * Filter documents that are versions (not originals)
   * @example Document.query().withScopes((scopes) => scopes.versions())
   */
  static versions = scope((query: Builder) => {
    return query.whereNotNull('parent_document_id')
  })

  /**
   * Filter original documents (not versions)
   * @example Document.query().withScopes((scopes) => scopes.originals())
   */
  static originals = scope((query: Builder) => {
    return query.whereNull('parent_document_id')
  })

  /**
   * Filter documents by version number
   * @example Document.query().withScopes((scopes) => scopes.byVersion(2))
   */
  static byVersion = scope((query, version: number) => {
    return query.where('version', version)
  })

  /**
   * Filter documents created between dates
   * @example Document.query().withScopes((scopes) => scopes.createdBetween(from, to))
   */
  static createdBetween = scope((query, from: DateTime, to: DateTime) => {
    return query.whereBetween('created_at', [from.toISO()!, to.toISO()!])
  })

  /**
   * Filter recently uploaded documents
   * @example Document.query().withScopes((scopes) => scopes.recentlyUploaded(7))
   */
  static recentlyUploaded = scope((query: Builder, days = 7) => {
    const date = DateTime.now().minus({ days })
    return query.where('created_at', '>=', date.toISO())
  })

  /**
   * Include case relationship
   * @example Document.query().withScopes((scopes) => scopes.withCase())
   */
  static withCase = scope((query) => {
    return query.preload('case', (caseQuery: any) => {
      caseQuery.preload('client')
    })
  })

  /**
   * Include client relationship
   * @example Document.query().withScopes((scopes) => scopes.withClient())
   */
  static withClient = scope((query) => {
    return query.preload('client')
  })

  /**
   * Include uploader relationship
   * @example Document.query().withScopes((scopes) => scopes.withUploader())
   */
  static withUploader = scope((query) => {
    return query.preload('uploader')
  })

  /**
   * Include all relationships
   * @example Document.query().withScopes((scopes) => scopes.withRelationships())
   */
  static withRelationships = scope((query) => {
    return query
      .preload('case', (q: any) => q.preload('client'))
      .preload('client')
      .preload('uploader')
  })

  /**
   * Order by file size (largest first)
   * @example Document.query().withScopes((scopes) => scopes.byLargestSize())
   */
  static byLargestSize = scope((query: Builder) => {
    return query.orderBy('file_size', 'desc')
  })

  /**
   * Order by file size (smallest first)
   * @example Document.query().withScopes((scopes) => scopes.bySmallestSize())
   */
  static bySmallestSize = scope((query: Builder) => {
    return query.orderBy('file_size', 'asc')
  })

  /**
   * Order by creation date (newest first)
   * @example Document.query().withScopes((scopes) => scopes.newest())
   */
  static newest = scope((query: Builder) => {
    return query.orderBy('created_at', 'desc')
  })

  /**
   * Order by creation date (oldest first)
   * @example Document.query().withScopes((scopes) => scopes.oldest())
   */
  static oldest = scope((query: Builder) => {
    return query.orderBy('created_at', 'asc')
  })

  /**
   * Order by title alphabetically
   * @example Document.query().withScopes((scopes) => scopes.alphabetical())
   */
  static alphabetical = scope((query: Builder) => {
    return query.orderBy('title', 'asc')
  })

  /**
   * ------------------------------------------------------
   * Computed Properties
   * ------------------------------------------------------
   */

  /**
   * Returns the file extension from the original filename
   * Example: 'document.pdf' -> 'pdf'
   */
  @computed()
  get file_extension(): string {
    return this.original_filename.split('.').pop() || ''
  }

  /**
   * Returns the file size in megabytes (MB)
   * Rounded to 2 decimal places
   */
  @computed()
  get file_size_mb(): number {
    return Math.round((this.file_size / 1024 / 1024) * 100) / 100
  }

  /**
   * Returns true if the document is a PDF file
   */
  @computed()
  get is_pdf(): boolean {
    return this.mime_type === 'application/pdf'
  }
}
