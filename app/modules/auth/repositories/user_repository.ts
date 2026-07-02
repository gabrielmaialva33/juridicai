import User from '#modules/auth/models/user'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

class UserRepository {
  query(trx?: TransactionClientContract) {
    return trx ? User.query({ client: trx }) : User.query()
  }

  findById(id: string) {
    return this.query().where('id', id).first()
  }

  findByIdOrFail(id: string) {
    return this.query().where('id', id).firstOrFail()
  }

  findByEmail(email: string) {
    return this.query().where('email', email).first()
  }

  async create(
    payload: { fullName?: string | null; email: string; password: string },
    trx?: TransactionClientContract
  ) {
    return User.create(payload, clientOptions(trx))
  }
}

function clientOptions(trx?: TransactionClientContract) {
  return trx ? { client: trx } : undefined
}

export default new UserRepository()
