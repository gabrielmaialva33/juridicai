import Document from '#models/document'

/**
 * Service for creating documents
 *
 * This service handles document creation with automatic defaults for:
 * - uploaded_by: Set from the uploadedBy parameter
 * - access_level: Defaults to 'tenant'
 * - is_ocr_processed: Defaults to false
 * - is_signed: Defaults to false
 * - version: Defaults to 1
 *
 * @example
 * const document = await createDocumentService.run(payload, userId)
 */
export default class CreateDocumentService {
  /**
   * Create a new document with automatic defaults
   *
   * @param payload - Document creation payload
   * @param uploadedBy - ID of the user uploading the document
   * @returns Promise<Document> - The created document
   */
  async run(
    payload: {
      case_id?: number | null
      client_id?: number | null
      title: string
      description?: string | null
      document_type:
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
      signature_data?: Record<string, any> | null
      tags?: string[] | null
      parent_document_id?: number | null
      // These fields are ignored and will be overridden by the service
      uploaded_by?: number
      access_level?: 'tenant' | 'case_team' | 'owner_only'
      is_ocr_processed?: boolean
      is_signed?: boolean
      version?: number
    },
    uploadedBy: number
  ): Promise<Document> {
    // Set automatic defaults
    const documentData = {
      ...payload,
      uploaded_by: uploadedBy,
      access_level: 'tenant' as const,
      is_ocr_processed: false,
      is_signed: false,
      version: 1,
    }

    return await Document.create(documentData as any)
  }
}
