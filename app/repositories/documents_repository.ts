import { inject } from '@adonisjs/core'
import Document from '#models/document'
import IDocument from '#interfaces/document_interface'
import LucidRepository from '#shared/lucid/lucid_repository'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

@inject()
export default class DocumentsRepository
  extends LucidRepository<typeof Document>
  implements IDocument.Repository
{
  constructor() {
    super(Document)
  }

  /**
   * Find documents by case ID
   * @param caseId
   */
  async findByCaseId(caseId: number): Promise<Document[]> {
    return await this.model.query().where('case_id', caseId)
  }

  /**
   * Find documents by client ID
   * @param clientId
   */
  async findByClientId(clientId: number): Promise<Document[]> {
    return await this.model.query().where('client_id', clientId)
  }

  /**
   * Find document by file hash
   * @param fileHash
   */
  async findByFileHash(fileHash: string): Promise<Document | null> {
    return await this.model.query().where('file_hash', fileHash).first()
  }

  /**
   * Search documents with pagination
   * @param search - Search term to match against title, description
   * @param page - Page number
   * @param limit - Results per page
   */
  async searchDocuments(
    search: string,
    page: number,
    limit: number
  ): Promise<ModelPaginatorContract<Document>> {
    const query = this.model.query()

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`
      query.where((builder) => {
        builder.whereILike('title', searchTerm).orWhereILike('description', searchTerm)
      })
    }

    return await query.paginate(page, limit)
  }

  /**
   * Find documents by document type
   * @param documentType - Type of document
   */
  async findByDocumentType(documentType: string): Promise<Document[]> {
    return await this.model.query().where('document_type', documentType)
  }

  /**
   * Find documents that need OCR processing
   */
  async findNeedingOcr(): Promise<Document[]> {
    return await this.model.query().where('is_ocr_processed', false)
  }

  /**
   * Find document versions
   * @param parentDocumentId - ID of the parent document
   */
  async findVersions(parentDocumentId: number): Promise<Document[]> {
    return await this.model
      .query()
      .where('parent_document_id', parentDocumentId)
      .orderBy('version', 'asc')
  }
}
