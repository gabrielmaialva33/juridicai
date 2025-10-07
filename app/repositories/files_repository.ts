import { inject } from '@adonisjs/core'
import File from '#models/file'
import IFile from '#interfaces/file_interface'
import LucidRepository from '#shared/lucid/lucid_repository'
import { DateTime } from 'luxon'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

@inject()
export default class FilesRepository
  extends LucidRepository<typeof File>
  implements IFile.Repository
{
  constructor() {
    super(File)
  }

  /**
   * Find files by owner ID
   * @param ownerId
   */
  async findByOwnerId(ownerId: number): Promise<File[]> {
    return await this.model.query().where('owner_id', ownerId).orderBy('created_at', 'desc')
  }

  /**
   * Find files by category
   * @param category
   */
  async findByCategory(category: string): Promise<File[]> {
    return await this.model.query().where('file_category', category).orderBy('created_at', 'desc')
  }

  /**
   * Find files by type/mime type
   * @param fileType
   */
  async findByType(fileType: string): Promise<File[]> {
    return await this.model.query().where('file_type', fileType).orderBy('created_at', 'desc')
  }

  /**
   * Search files by name or client name
   * @param search - Search term to match against file_name, client_name
   * @param page - Page number
   * @param limit - Results per page
   */
  async searchFiles(
    search: string,
    page: number,
    limit: number
  ): Promise<ModelPaginatorContract<File>> {
    const query = this.model.query()

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`
      query.where((builder) => {
        builder.whereILike('file_name', searchTerm).orWhereILike('client_name', searchTerm)
      })
    }

    return await query.orderBy('created_at', 'desc').paginate(page, limit)
  }

  /**
   * Find files larger than specified size
   * @param sizeInBytes
   */
  async findLargerThan(sizeInBytes: number): Promise<File[]> {
    return await this.model
      .query()
      .where('file_size', '>', sizeInBytes)
      .orderBy('file_size', 'desc')
  }

  /**
   * Find files smaller than specified size
   * @param sizeInBytes
   */
  async findSmallerThan(sizeInBytes: number): Promise<File[]> {
    return await this.model.query().where('file_size', '<', sizeInBytes).orderBy('file_size', 'asc')
  }

  /**
   * Get recently uploaded files
   * @param days - Number of days to look back
   */
  async getRecentFiles(days: number): Promise<File[]> {
    const date = DateTime.now().minus({ days })
    return await this.model
      .query()
      .where('created_at', '>=', date.toISO()!)
      .orderBy('created_at', 'desc')
  }
}
