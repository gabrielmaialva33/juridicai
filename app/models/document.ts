import { DateTime } from 'luxon'
import { belongsTo, column, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
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
    consume: (value: string | null) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare signature_data: Record<string, any> | null

  // Access control
  @column()
  declare access_level: AccessLevel

  // Organization
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

  // Relationships
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

  /**
   * ------------------------------------------------------
   * Query Scopes
   * ------------------------------------------------------
   */

  /**
   * Search documents by title, description or OCR text
   * @example Document.query().withScopes(s => s.search('contract'))
   */
  static search = scope((query: ModelQueryBuilderContract<typeof Document>, term: string) => {
    if (!term || !term.trim()) return

    const searchTerm = `%${term.trim()}%`
    query.where((builder) => {
      builder
        .whereILike('title', searchTerm)
        .orWhereILike('description', searchTerm)
        .orWhereILike('original_filename', searchTerm)
        .orWhereILike('ocr_text', searchTerm)
    })
  })

  /**
   * Filter documents by type
   * @example Document.query().withScopes(s => s.byType('contract'))
   */
  static byType = scope((query: ModelQueryBuilderContract<typeof Document>, type: DocumentType) => {
    query.where('document_type', type)
  })

  /**
   * Filter documents by multiple types
   * @example Document.query().withScopes(s => s.byTypes(['contract', 'agreement']))
   */
  static byTypes = scope(
    (query: ModelQueryBuilderContract<typeof Document>, types: DocumentType[]) => {
      query.whereIn('document_type', types)
    }
  )

  /**
   * Filter documents for a specific case
   * @example Document.query().withScopes(s => s.forCase(caseId))
   */
  static forCase = scope((query: ModelQueryBuilderContract<typeof Document>, caseId: number) => {
    query.where('case_id', caseId)
  })

  /**
   * Filter documents for a specific client
   * @example Document.query().withScopes(s => s.forClient(clientId))
   */
  static forClient = scope(
    (query: ModelQueryBuilderContract<typeof Document>, clientId: number) => {
      query.where('client_id', clientId)
    }
  )

  /**
   * Filter documents without case association
   * @example Document.query().withScopes(s => s.withoutCase())
   */
  static withoutCase = scope((query: ModelQueryBuilderContract<typeof Document>) => {
    query.whereNull('case_id')
  })

  /**
   * Filter signed documents
   * @example Document.query().withScopes(s => s.signed())
   */
  static signed = scope((query: ModelQueryBuilderContract<typeof Document>) => {
    query.where('is_signed', true)
  })

  /**
   * Filter unsigned documents
   * @example Document.query().withScopes(s => s.unsigned())
   */
  static unsigned = scope((query: ModelQueryBuilderContract<typeof Document>) => {
    query.where('is_signed', false)
  })

  /**
   * Filter documents with OCR processing
   * @example Document.query().withScopes(s => s.ocrProcessed())
   */
  static ocrProcessed = scope((query: ModelQueryBuilderContract<typeof Document>) => {
    query.where('is_ocr_processed', true)
  })

  /**
   * Filter documents pending OCR processing
   * @example Document.query().withScopes(s => s.pendingOcr())
   */
  static pendingOcr = scope((query: ModelQueryBuilderContract<typeof Document>) => {
    query.where('is_ocr_processed', false)
  })

  /**
   * Filter documents by access level
   * @example Document.query().withScopes(s => s.byAccessLevel('tenant'))
   */
  static byAccessLevel = scope(
    (query: ModelQueryBuilderContract<typeof Document>, level: AccessLevel) => {
      query.where('access_level', level)
    }
  )

  /**
   * Filter documents uploaded by specific user
   * @example Document.query().withScopes(s => s.uploadedBy(userId))
   */
  static uploadedBy = scope((query: ModelQueryBuilderContract<typeof Document>, userId: number) => {
    query.where('uploaded_by', userId)
  })

  /**
   * Filter documents by mime type
   * @example Document.query().withScopes(s => s.byMimeType('application/pdf'))
   */
  static byMimeType = scope(
    (query: ModelQueryBuilderContract<typeof Document>, mimeType: string) => {
      query.where('mime_type', mimeType)
    }
  )

  /**
   * Filter PDF documents
   * @example Document.query().withScopes(s => s.pdfs())
   */
  static pdfs = scope((query: ModelQueryBuilderContract<typeof Document>) => {
    query.where('mime_type', 'application/pdf')
  })

  /**
   * Filter image documents
   * @example Document.query().withScopes(s => s.images())
   */
  static images = scope((query: ModelQueryBuilderContract<typeof Document>) => {
    query.whereIn('mime_type', [
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
   * @example Document.query().withScopes(s => s.sizeBetween(0, 5242880)) // 0-5MB
   */
  static sizeBetween = scope(
    (query: ModelQueryBuilderContract<typeof Document>, minSize: number, maxSize: number) => {
      query.whereBetween('file_size', [minSize, maxSize])
    }
  )

  /**
   * Filter large documents (>10MB)
   * @example Document.query().withScopes(s => s.largeFiles())
   */
  static largeFiles = scope((query: ModelQueryBuilderContract<typeof Document>) => {
    query.where('file_size', '>', 10 * 1024 * 1024)
  })

  /**
   * Filter documents with specific tag
   * @example Document.query().withScopes(s => s.hasTag('important'))
   */
  static hasTag = scope((query: ModelQueryBuilderContract<typeof Document>, tag: string) => {
    query.whereRaw('? = ANY(tags)', [tag])
  })

  /**
   * Filter documents with any of the tags
   * @example Document.query().withScopes(s => s.hasAnyTag(['important', 'urgent']))
   */
  static hasAnyTag = scope((query: ModelQueryBuilderContract<typeof Document>, tags: string[]) => {
    query.whereRaw('tags && ?', [`{${tags.join(',')}}`])
  })

  /**
   * Filter by storage provider
   * @example Document.query().withScopes(s => s.byStorage('s3'))
   */
  static byStorage = scope(
    (query: ModelQueryBuilderContract<typeof Document>, provider: StorageProvider) => {
      query.where('storage_provider', provider)
    }
  )

  /**
   * Filter documents that are versions (not originals)
   * @example Document.query().withScopes(s => s.versions())
   */
  static versions = scope((query: ModelQueryBuilderContract<typeof Document>) => {
    query.whereNotNull('parent_document_id')
  })

  /**
   * Filter original documents (not versions)
   * @example Document.query().withScopes(s => s.originals())
   */
  static originals = scope((query: ModelQueryBuilderContract<typeof Document>) => {
    query.whereNull('parent_document_id')
  })

  /**
   * Filter documents by version number
   * @example Document.query().withScopes(s => s.byVersion(2))
   */
  static byVersion = scope((query: ModelQueryBuilderContract<typeof Document>, version: number) => {
    query.where('version', version)
  })

  /**
   * Filter documents created between dates
   * @example Document.query().withScopes(s => s.createdBetween(from, to))
   */
  static createdBetween = scope(
    (query: ModelQueryBuilderContract<typeof Document>, from: DateTime, to: DateTime) => {
      query.whereBetween('created_at', [from.toSQL(), to.toSQL()])
    }
  )

  /**
   * Filter recently uploaded documents
   * @example Document.query().withScopes(s => s.recentlyUploaded(7))
   */
  static recentlyUploaded = scope((query: ModelQueryBuilderContract<typeof Document>, days = 7) => {
    const date = DateTime.now().minus({ days })
    query.where('created_at', '>=', date.toSQL())
  })

  /**
   * Include case relationship
   * @example Document.query().withScopes(s => s.withCase())
   */
  static withCase = scope((query: ModelQueryBuilderContract<typeof Document>) => {
    query.preload('case', (caseQuery) => {
      caseQuery.preload('client')
    })
  })

  /**
   * Include client relationship
   * @example Document.query().withScopes(s => s.withClient())
   */
  static withClient = scope((query: ModelQueryBuilderContract<typeof Document>) => {
    query.preload('client')
  })

  /**
   * Include uploader relationship
   * @example Document.query().withScopes(s => s.withUploader())
   */
  static withUploader = scope((query: ModelQueryBuilderContract<typeof Document>) => {
    query.preload('uploader')
  })

  /**
   * Include all relationships
   * @example Document.query().withScopes(s => s.withRelationships())
   */
  static withRelationships = scope((query: ModelQueryBuilderContract<typeof Document>) => {
    query
      .preload('case', (q) => q.preload('client'))
      .preload('client')
      .preload('uploader')
  })

  /**
   * Order by file size (largest first)
   * @example Document.query().withScopes(s => s.byLargestSize())
   */
  static byLargestSize = scope((query: ModelQueryBuilderContract<typeof Document>) => {
    query.orderBy('file_size', 'desc')
  })

  /**
   * Order by file size (smallest first)
   * @example Document.query().withScopes(s => s.bySmallestSize())
   */
  static bySmallestSize = scope((query: ModelQueryBuilderContract<typeof Document>) => {
    query.orderBy('file_size', 'asc')
  })

  /**
   * Order by creation date (newest first)
   * @example Document.query().withScopes(s => s.newest())
   */
  static newest = scope((query: ModelQueryBuilderContract<typeof Document>) => {
    query.orderBy('created_at', 'desc')
  })

  /**
   * Order by creation date (oldest first)
   * @example Document.query().withScopes(s => s.oldest())
   */
  static oldest = scope((query: ModelQueryBuilderContract<typeof Document>) => {
    query.orderBy('created_at', 'asc')
  })

  /**
   * Order by title alphabetically
   * @example Document.query().withScopes(s => s.alphabetical())
   */
  static alphabetical = scope((query: ModelQueryBuilderContract<typeof Document>) => {
    query.orderBy('title', 'asc')
  })
}
