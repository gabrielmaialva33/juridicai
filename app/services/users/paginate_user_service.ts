import { inject } from '@adonisjs/core'
import { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

import UsersRepository from '#repositories/users_repository'
import User from '#models/user'

import { PaginateOptions } from '#shared/lucid/lucid_repository_interface'

interface PaginateUsersOptions extends PaginateOptions<typeof User> {
  search?: string
  tenantId?: number
}

@inject()
export default class PaginateUserService {
  constructor(private userRepository: UsersRepository) {}

  async run(options: PaginateUsersOptions) {
    const { search, tenantId, ...paginateOptions } = options

    const modifyQuery = (query: ModelQueryBuilderContract<typeof User>) => {
      // Filter by tenant if tenantId is provided
      if (tenantId) {
        query.whereHas('tenant_users', (tenantQuery) => {
          tenantQuery.where('tenant_id', tenantId)
        })
      }

      if (search) {
        query.where((builder: ModelQueryBuilderContract<typeof User>) => {
          builder.where('full_name', 'like', `%${search}%`).orWhere('email', 'like', `%${search}%`)
        })
      }
    }

    paginateOptions.modifyQuery = paginateOptions.modifyQuery
      ? (query) => {
          paginateOptions.modifyQuery!(query)
          modifyQuery(query)
          query.preload('roles')
        }
      : (query) => {
          modifyQuery(query)
          query.preload('roles')
        }

    return this.userRepository.paginate(paginateOptions)
  }
}
