import LucidRepositoryInterface from '#shared/lucid/lucid_repository_interface'
import File from '#models/file'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

namespace IFile {
  export interface Repository extends LucidRepositoryInterface<typeof File> {
    /**
     * Find files by owner ID
     * @param ownerId
     */
    findByOwnerId(ownerId: number): Promise<File[]>

    /**
     * Find files by category
     * @param category
     */
    findByCategory(category: string): Promise<File[]>

    /**
     * Find files by type/mime type
     * @param fileType
     */
    findByType(fileType: string): Promise<File[]>

    /**
     * Search files by name or client name
     * @param search - Search term to match against file_name, client_name
     * @param page - Page number
     * @param limit - Results per page
     */
    searchFiles(search: string, page: number, limit: number): Promise<ModelPaginatorContract<File>>

    /**
     * Find files larger than specified size
     * @param sizeInBytes
     */
    findLargerThan(sizeInBytes: number): Promise<File[]>

    /**
     * Find files smaller than specified size
     * @param sizeInBytes
     */
    findSmallerThan(sizeInBytes: number): Promise<File[]>

    /**
     * Get recently uploaded files
     * @param days - Number of days to look back
     */
    getRecentFiles(days: number): Promise<File[]>
  }

  export interface CreatePayload {
    owner_id: number
    client_name: string
    file_name: string
    file_size: number
    file_type: string
    file_category: string
    url: string
  }

  export interface EditPayload {
    client_name?: string
    file_name?: string
    file_category?: string
  }

  export interface FilterPayload {
    owner_id?: number
    file_category?: string
    file_type?: string
    min_size?: number
    max_size?: number
  }
}

export default IFile
