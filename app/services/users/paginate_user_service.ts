import { inject } from '@adonisjs/core'
import { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

import UsersRepository from '#repositories/users_repository'
import User from '#models/user'

import { PaginateOptions } from '#shared/lucid/lucid_repository_interface'

interface PaginateUsersOptions extends PaginateOptions<typeof User> {
  search?: string
  tenantId?: string | number
  withRoles?: boolean
  withPermissions?: boolean
  onlyVerified?: boolean
  roleFilter?: string | string[]
}

@inject()
export default class PaginateUserService {
  constructor(private userRepository: UsersRepository) {}

  async run(options: PaginateUsersOptions) {
    const {
      search,
      tenantId,
      withRoles = true,
      withPermissions = false,
      onlyVerified = false,
      roleFilter,
      ...paginateOptions
    } = options

    const modifyQuery = (query: ModelQueryBuilderContract<typeof User>) => {
      // Apply scopes using withScopes for better readability and maintainability
      query.withScopes((scopes) => {
        // Apply search scope if search term provided
        if (search) {
          scopes.searchByTerm(search)
        }

        // Filter by tenant if tenantId is provided
        if (tenantId) {
          scopes.forTenant(tenantId)
        }

        // Filter by verified users only
        if (onlyVerified) {
          scopes.verified()
        }

        // Filter by role(s)
        if (roleFilter) {
          if (Array.isArray(roleFilter)) {
            scopes.byRoles(roleFilter)
          } else {
            scopes.byRole(roleFilter)
          }
        }

        // Include roles relationship
        if (withRoles) {
          scopes.withRoles()
        }

        // Include permissions (both direct and from roles)
        if (withPermissions) {
          scopes.withPermissions()
        }

        // Always filter active users (not deleted)
        scopes.active()
      })
    }

    paginateOptions.modifyQuery = paginateOptions.modifyQuery
      ? (query) => {
          paginateOptions.modifyQuery!(query)
          modifyQuery(query)
        }
      : modifyQuery

    return this.userRepository.paginate(paginateOptions)
  }
}
