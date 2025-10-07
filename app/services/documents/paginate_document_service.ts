import { inject } from '@adonisjs/core'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

import DocumentsRepository from '#repositories/documents_repository'
import Document from '#models/document'
import { PaginateOptions } from '#shared/lucid/lucid_repository_interface'

interface PaginateDocumentsOptions extends PaginateOptions<typeof Document> {
  search?: string
  caseId?: number
  clientId?: number
  documentType?:
    | 'petition'
    | 'contract'
    | 'evidence'
    | 'judgment'
    | 'appeal'
    | 'power_of_attorney'
    | 'agreement'
    | 'report'
    | 'other'
  uploadedBy?: number
  isSigned?: boolean
  isOcrProcessed?: boolean
  tags?: string[]
  withCase?: boolean
  withClient?: boolean
  withUploader?: boolean
}

@inject()
export default class PaginateDocumentService {
  constructor(private documentsRepository: DocumentsRepository) {}

  /**
   * Paginate documents with advanced filters using model scopes
   * Provides comprehensive filtering for document management
   *
   * @param options - Pagination and filter options
   * @returns Paginated list of documents
   */
  async run(options: PaginateDocumentsOptions): Promise<ModelPaginatorContract<Document>> {
    const {
      search,
      caseId,
      clientId,
      documentType,
      uploadedBy,
      isSigned,
      isOcrProcessed,
      tags,
      withCase = false,
      withClient = false,
      withUploader = false,
      ...paginateOptions
    } = options

    const modifyQuery = (query: ModelQueryBuilderContract<typeof Document>) => {
      query.withScopes((scopes) => {
        // Text search
        if (search) {
          scopes.search(search)
        }

        // Filter by case
        if (caseId) {
          scopes.forCase(caseId)
        }

        // Filter by client
        if (clientId) {
          scopes.forClient(clientId)
        }

        // Filter by document type
        if (documentType) {
          scopes.byType(documentType)
        }

        // Filter by uploader
        if (uploadedBy) {
          scopes.uploadedBy(uploadedBy)
        }

        // Filter by signed status
        if (isSigned !== undefined) {
          isSigned ? scopes.signed() : scopes.unsigned()
        }

        // Filter by OCR processing status
        if (isOcrProcessed !== undefined) {
          isOcrProcessed ? scopes.ocrProcessed() : scopes.pendingOcr()
        }

        // Filter by tags
        if (tags && tags.length > 0) {
          if (tags.length === 1) {
            scopes.hasTag(tags[0])
          } else {
            scopes.hasAnyTag(tags)
          }
        }

        // Include relationships
        if (withCase) {
          scopes.withCase()
        }

        if (withClient) {
          scopes.withClient()
        }

        if (withUploader) {
          scopes.withUploader()
        }

        // Default ordering by creation date (newest first)
        scopes.newest()
      })
    }

    paginateOptions.modifyQuery = paginateOptions.modifyQuery
      ? (query) => {
          paginateOptions.modifyQuery!(query)
          modifyQuery(query)
        }
      : modifyQuery

    return this.documentsRepository.paginate(paginateOptions) as Promise<
      ModelPaginatorContract<Document>
    >
  }
}
