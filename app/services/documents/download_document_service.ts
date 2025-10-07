import { inject } from '@adonisjs/core'
import drive from '@adonisjs/drive/services/main'
import DocumentsRepository from '#repositories/documents_repository'
import NotFoundException from '#exceptions/not_found_exception'
import Document from '#models/document'

/**
 * Service for downloading documents from various storage providers
 *
 * Supports:
 * - Local filesystem: Direct file streaming
 * - S3/R2/Spaces: Signed URL generation
 * - GCS: Signed URL generation
 *
 * @example
 * const url = await downloadDocumentService.run(123)
 * const stream = await downloadDocumentService.stream(123)
 */
@inject()
export default class DownloadDocumentService {
  constructor(private documentsRepository: DocumentsRepository) {}

  /**
   * Get a signed URL for document download
   *
   * @param documentId - The ID of the document to download
   * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
   * @returns Signed URL or local file path
   * @throws {NotFoundException} if document not found
   */
  async getSignedUrl(documentId: number, expiresIn: number = 3600): Promise<string> {
    const document = await this.documentsRepository.findBy('id', documentId)

    if (!document) {
      throw new NotFoundException('Document not found')
    }

    const disk = this.getDiskForProvider(document.storage_provider)

    // For local filesystem, return the public URL
    if (document.storage_provider === 'local') {
      return await drive.use(disk).getUrl(document.file_path)
    }

    // For cloud providers, generate signed URL
    return await drive.use(disk).getSignedUrl(document.file_path, {
      expiresIn,
      contentType: document.mime_type,
      contentDisposition: `attachment; filename="${document.original_filename}"`,
    })
  }

  /**
   * Get a readable stream for document download
   * Best for local filesystem streaming
   *
   * @param documentId - The ID of the document to download
   * @returns Document metadata and file stream
   * @throws {NotFoundException} if document not found
   */
  async stream(documentId: number): Promise<{
    document: Document
    stream: NodeJS.ReadableStream
  }> {
    const document = await this.documentsRepository.findBy('id', documentId)

    if (!document) {
      throw new NotFoundException('Document not found')
    }

    const disk = this.getDiskForProvider(document.storage_provider)
    const stream = await drive.use(disk).getStream(document.file_path)

    return {
      document,
      stream,
    }
  }

  /**
   * Map storage provider to drive disk name
   */
  private getDiskForProvider(provider: string): 'fs' | 's3' | 'gcs' | 'r2' | 'spaces' {
    switch (provider) {
      case 'local':
        return 'fs'
      case 's3':
        return 's3'
      case 'gcs':
        return 'gcs'
      default:
        return 'fs'
    }
  }
}
