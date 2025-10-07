import LucidRepositoryInterface from '#shared/lucid/lucid_repository_interface'
import Document from '#models/document'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

namespace IDocument {
  export interface Repository extends LucidRepositoryInterface<typeof Document> {
    /**
     * Find documents by case ID
     * @param caseId
     */
    findByCaseId(caseId: number): Promise<Document[]>

    /**
     * Find documents by client ID
     * @param clientId
     */
    findByClientId(clientId: number): Promise<Document[]>

    /**
     * Find document by file hash
     * @param fileHash
     */
    findByFileHash(fileHash: string): Promise<Document | null>

    /**
     * Search documents with pagination
     * @param search - Search term to match against title, description
     * @param page - Page number
     * @param limit - Results per page
     */
    searchDocuments(
      search: string,
      page: number,
      limit: number
    ): Promise<ModelPaginatorContract<Document>>

    /**
     * Find documents by document type
     * @param documentType - Type of document
     */
    findByDocumentType(documentType: string): Promise<Document[]>

    /**
     * Find documents that need OCR processing
     */
    findNeedingOcr(): Promise<Document[]>

    /**
     * Find document versions
     * @param parentDocumentId - ID of the parent document
     */
    findVersions(parentDocumentId: number): Promise<Document[]>
  }

  export interface CreatePayload {
    case_id?: number | null
    client_id?: number | null
    uploaded_by: number
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
    file_path: string
    file_hash?: string | null
    file_size: number
    mime_type: string
    original_filename: string
    storage_provider: 'local' | 's3' | 'gcs'
    ocr_text?: string | null
    is_ocr_processed?: boolean
    is_signed?: boolean
    signature_data?: Record<string, any> | null
    access_level?: 'tenant' | 'case_team' | 'owner_only'
    tags?: string[] | null
    version?: number
    parent_document_id?: number | null
  }

  export interface EditPayload {
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
    ocr_text?: string | null
    is_ocr_processed?: boolean
    is_signed?: boolean
    signature_data?: Record<string, any> | null
    access_level?: 'tenant' | 'case_team' | 'owner_only'
    tags?: string[] | null
  }

  export interface FilterPayload {
    case_id?: number
    client_id?: number
    document_type?: string
    is_ocr_processed?: boolean
    is_signed?: boolean
    access_level?: string
    tags?: string[]
  }
}

export default IDocument
