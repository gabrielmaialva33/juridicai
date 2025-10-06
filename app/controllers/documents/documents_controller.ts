import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'

import Document from '#models/document'
import { createDocumentValidator, updateDocumentValidator } from '#validators/document'

@inject()
export default class DocumentsController {
  /**
   * GET /api/v1/documents
   */
  async paginate({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const perPage = request.input('per_page', 20)
    const sortBy = request.input('sort_by', 'created_at')
    const direction = request.input('order', 'desc')
    const search = request.input('search', undefined)
    const caseId = request.input('case_id', undefined)
    const clientId = request.input('client_id', undefined)
    const documentType = request.input('document_type', undefined)

    const query = Document.query()
      .if(caseId, (q) => q.where('case_id', caseId))
      .if(clientId, (q) => q.where('client_id', clientId))
      .if(documentType, (q) => q.where('document_type', documentType))
      .if(search, (q) =>
        q.where((builder) => {
          builder.whereILike('title', `%${search}%`)
          builder.orWhereILike('description', `%${search}%`)
        })
      )
      .orderBy(sortBy, direction)

    const documents = await query.paginate(page, perPage)

    return response.json(documents)
  }

  /**
   * GET /api/v1/documents/:id
   */
  async get({ params, response }: HttpContext) {
    const documentId = +params.id
    const document = await Document.find(documentId)

    if (!document) {
      return response.status(404).json({
        message: 'Document not found',
      })
    }

    await (document as any).load('case')
    await (document as any).load('client')
    return response.json(document)
  }

  /**
   * POST /api/v1/documents
   */
  async create({ request, response, auth }: HttpContext) {
    const payload = await createDocumentValidator.validate(request.all())

    const document = await Document.create({
      ...payload,
      uploaded_by: auth.user!.id,
      access_level: payload.access_level || 'tenant',
      is_ocr_processed: false,
      is_signed: false,
      version: 1,
    })

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

    const document = await Document.find(documentId)

    if (!document) {
      return response.status(404).json({
        message: 'Document not found',
      })
    }

    document.merge(payload)
    await document.save()
    return response.json(document)
  }

  /**
   * DELETE /api/v1/documents/:id
   */
  async delete({ params, response }: HttpContext) {
    const documentId = +params.id
    const document = await Document.find(documentId)

    if (!document) {
      return response.status(404).json({
        message: 'Document not found',
      })
    }

    // TODO: Implement file deletion from storage provider
    await document.delete()
    return response.noContent()
  }

  /**
   * GET /api/v1/documents/:id/download
   * TODO: Implement actual file download from storage provider
   */
  async download({ params, response }: HttpContext) {
    const documentId = +params.id
    const document = await Document.find(documentId)

    if (!document) {
      return response.status(404).json({
        message: 'Document not found',
      })
    }

    // TODO: Generate signed URL for S3/GCS or stream local file
    return response.json({
      message: 'Download endpoint - implementation needed',
      document: {
        id: document.id,
        title: document.title,
        file_path: document.file_path,
        storage_provider: document.storage_provider,
      },
    })
  }
}
