import Document from '#models/document'

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
export default class GetDocumentService {
  /**
   * Get a document by ID with optional relationships
   *
   * @param documentId - The ID of the document to retrieve
   * @param options - Options for loading relationships
   * @param options.withCase - Load the case relationship
   * @param options.withClient - Load the client relationship
   * @returns Promise<Document | null> - The document or null if not found
   */
  async run(
    documentId: number,
    options: {
      withCase?: boolean
      withClient?: boolean
    } = {}
  ): Promise<Document | null> {
    const document = await Document.find(documentId)

    if (!document) {
      return null
    }

    // Load relationships if requested
    if (options.withCase) {
      await (document as any).load('case', (caseQuery: any) => {
        caseQuery.preload('client')
      })
    }

    if (options.withClient) {
      await (document as any).load('client')
    }

    return document
  }
}
