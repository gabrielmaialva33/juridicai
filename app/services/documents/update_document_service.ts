import { inject } from '@adonisjs/core'
import Document from '#models/document'
import DocumentsRepository from '#repositories/documents_repository'
import NotFoundException from '#exceptions/not_found_exception'

/**
 * Service for updating an existing document
 *
 * Uses merge() and save() pattern for updates
 *
 * @example
 * const updated = await updateDocumentService.run(123, { title: 'New Title' })
 */
@inject()
export default class UpdateDocumentService {
  constructor(private documentsRepository: DocumentsRepository) {}

  /**
   * Update a document by ID
   *
   * @param documentId - The ID of the document to update
   * @param payload - The fields to update
   * @returns Promise<Document> - The updated document
   * @throws {NotFoundException} if document not found
   */
  async run(
    documentId: number,
    payload: {
      case_id?: number | null
      client_id?: number | null
      title?: string
      description?: string | null
      document_type?:
        | 'petition'
        | 'contract'
        | 'evidence'
        | 'judgment'
        | 'appeal'
        | 'power_of_attorney'
        | 'agreement'
        | 'report'
        | 'other'
      file_path?: string
      file_hash?: string | null
      file_size?: number
      mime_type?: string
      original_filename?: string
      storage_provider?: 'local' | 's3' | 'gcs'
      ocr_text?: string | null
      is_ocr_processed?: boolean
      is_signed?: boolean
      signature_data?: Record<string, any> | null
      access_level?: 'tenant' | 'case_team' | 'owner_only'
      tags?: string[] | null
      version?: number
      parent_document_id?: number | null
    }
  ): Promise<Document> {
    const document = await this.documentsRepository.findBy('id', documentId)

    if (!document) {
      throw new NotFoundException('Document not found')
    }

    document.merge(payload)
    await document.save()

    return document
  }
}
