import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'

import User from '#models/user'
import GetDocumentService from '#services/documents/get_document_service'
import PaginateDocumentService from '#services/documents/paginate_document_service'
import CreateDocumentService from '#services/documents/create_document_service'
import UpdateDocumentService from '#services/documents/update_document_service'
import DeleteDocumentService from '#services/documents/delete_document_service'
import DownloadDocumentService from '#services/documents/download_document_service'
import { createDocumentValidator, updateDocumentValidator } from '#validators/document'

@inject()
export default class DocumentsController {
  constructor(
    private getDocumentService: GetDocumentService,
    private paginateDocumentService: PaginateDocumentService,
    private createDocumentService: CreateDocumentService,
    private updateDocumentService: UpdateDocumentService,
    private deleteDocumentService: DeleteDocumentService,
    private downloadDocumentService: DownloadDocumentService
  ) {}

  /**
   * GET /documents
   * Render documents page (Inertia)
   */
  async index({ inertia }: HttpContext) {
    return inertia.render('documents/index')
  }

  /**
   * GET /api/v1/documents
   */
  async paginate({ request, response }: HttpContext) {
    const documents = await this.paginateDocumentService.run({
      page: request.input('page', 1),
      perPage: request.input('per_page', 20),
      sortBy: request.input('sort_by', 'created_at'),
      direction: request.input('order', 'desc'),
      search: request.input('search', undefined),
      caseId: request.input('case_id', undefined),
      clientId: request.input('client_id', undefined),
      documentType: request.input('document_type', undefined),
    })

    return response.json(documents)
  }

  /**
   * GET /api/v1/documents/:id
   */
  async get({ params, response }: HttpContext) {
    const documentId = +params.id
    const document = await this.getDocumentService.run(documentId, {
      withCase: true,
      withClient: true,
    })

    if (!document) {
      return response.status(404).json({
        message: 'Document not found',
      })
    }

    return response.json(document)
  }

  /**
   * POST /api/v1/documents
   */
  async create({ request, response, auth }: HttpContext) {
    const payload = await createDocumentValidator.validate(request.all())
    const user = await auth.getUserOrFail() as unknown as User
    const document = await this.createDocumentService.run(payload, user.id)

    return response.created(document)
  }

  /**
   * PATCH /api/v1/documents/:id
   */
  async update({ params, request, response }: HttpContext) {
    const documentId = +params.id
    const payload = await updateDocumentValidator.validate(request.all(), {
      meta: { documentId },
    })

    const document = await this.updateDocumentService.run(documentId, payload)
    return response.json(document)
  }

  /**
   * DELETE /api/v1/documents/:id
   */
  async delete({ params, response }: HttpContext) {
    const documentId = +params.id
    await this.deleteDocumentService.run(documentId)
    return response.noContent()
  }

  /**
   * GET /api/v1/documents/:id/download
   * Download document or get signed URL
   *
   * For local files: Streams file directly
   * For cloud providers (S3/GCS): Returns signed URL
   */
  async download({ params, request, response }: HttpContext) {
    const documentId = +params.id

    // Check if client wants a signed URL or direct stream
    const urlOnly = request.input('url_only', 'false') === 'true'

    if (urlOnly) {
      // Return signed URL for client-side download
      const expiresIn = request.input('expires_in', 3600)
      const url = await this.downloadDocumentService.getSignedUrl(documentId, expiresIn)

      return response.json({
        url,
        expires_in: expiresIn,
      })
    }

    // Stream file directly (best for local storage)
    const { document, stream } = await this.downloadDocumentService.stream(documentId)

    response.header('Content-Type', document.mime_type)
    response.header('Content-Disposition', `attachment; filename="${document.original_filename}"`)
    response.header('Content-Length', document.file_size.toString())

    return response.stream(stream as any)
  }
}
