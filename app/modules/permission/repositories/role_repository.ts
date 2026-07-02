import Role from '#modules/permission/models/role'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

class RoleRepository {
  query(trx?: TransactionClientContract) {
    return trx ? Role.query({ client: trx }) : Role.query()
  }

  list() {
    return this.query().orderBy('slug', 'asc')
  }

  findBySlug(slug: string) {
    return this.query().where('slug', slug).first()
  }

  findBySlugOrFail(slug: string, trx?: TransactionClientContract) {
    return this.query(trx).where('slug', slug).firstOrFail()
  }
}

export default new RoleRepository()
