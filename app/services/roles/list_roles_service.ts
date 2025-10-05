import { inject } from '@adonisjs/core'

import RolesRepository from '#repositories/roles_repository'

@inject()
export default class ListRolesService {
  constructor(private rolesRepository: RolesRepository) {}

  async run(page: number = 1, perPage: number = 10) {
    if (page) {
      return this.rolesRepository.paginate({
        page: page,
        perPage: perPage,
      })
    }
    const roles = await this.rolesRepository.list()
    return {
      data: roles,
      meta: {
        total: roles.length,
        perPage: roles.length,
        currentPage: 1,
        lastPage: 1,
        firstPage: 1,
        firstPageUrl: '/?page=1',
        lastPageUrl: '/?page=1',
        nextPageUrl: null,
        previousPageUrl: null,
      },
    }
  }
}
