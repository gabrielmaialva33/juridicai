import { inject } from '@adonisjs/core'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import Document from '#models/document'
import Case from '#models/case'
import DocumentsRepository from '#repositories/documents_repository'
import NotFoundException from '#exceptions/not_found_exception'

/**
 * Service for retrieving a document by ID with optional relationships
 *
 * Supports loading related data:
 * - withCase: Load the associated case (with client preloaded)
 * - withClient: Load the associated client
 *
 * @example
 * const document = await getDocumentService.run(123, { withCase: true, withClient: true })
 */
@inject()
export default class GetDocumentService {
  constructor(private documentsRepository: DocumentsRepository) {}

  /**
   * Get a document by ID with optional relationships
   *
   * @param documentId - The ID of the document to retrieve
   * @param options - Options for loading relationships
   * @param options.withCase - Load the case relationship
   * @param options.withClient - Load the client relationship
   * @returns Promise<Document> - The document instance
   * @throws {NotFoundException} if document not found
   */
  async run(
    documentId: number,
    options: {
      withCase?: boolean
      withClient?: boolean
    } = {}
  ): Promise<Document> {
    const document = await this.documentsRepository.findBy('id', documentId)

    if (!document) {
      throw new NotFoundException('Document not found')
    }

    // Load relationships if requested
    if (options.withCase) {
      await document.load('case', (caseQuery: ModelQueryBuilderContract<typeof Case>) => {
        caseQuery.preload('client')
      })
    }

    if (options.withClient) {
      await document.load('client')
    }

    return document
  }
}
