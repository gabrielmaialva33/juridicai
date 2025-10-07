import { inject } from '@adonisjs/core'
import UsersRepository from '#repositories/users_repository'
import User from '#models/user'
import NotFoundException from '#exceptions/not_found_exception'

@inject()
export default class GetUserService {
  constructor(private userRepository: UsersRepository) {}

  async run(userId: number): Promise<User> {
    const user = await this.userRepository.findBy('id', userId, {
      modifyQuery: (query) => query.preload('roles'),
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return user
  }
}
