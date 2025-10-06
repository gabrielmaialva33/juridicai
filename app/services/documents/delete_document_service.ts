import Document from '#models/document'
import NotFoundException from '#exceptions/not_found_exception'

/**
 * Service for deleting a document
 *
 * Performs hard delete using document.delete()
 *
 * @example
 * await deleteDocumentService.run(123)
 */
export default class DeleteDocumentService {
  /**
   * Delete a document by ID
   *
   * @param documentId - The ID of the document to delete
   * @returns Promise<void>
   * @throws {NotFoundException} if document not found
   */
  async run(documentId: number): Promise<void> {
    const document = await Document.find(documentId)

    if (!document) {
      throw new NotFoundException('Document not found')
    }

    await document.delete()
  }
}
