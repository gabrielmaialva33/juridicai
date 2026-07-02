import Tenant from '#modules/tenant/models/tenant'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { TenantStatus } from '#shared/types/model_enums'

class TenantRepository {
  query(trx?: TransactionClientContract) {
    return trx ? Tenant.query({ client: trx }) : Tenant.query()
  }

  list() {
    return this.query().orderBy('name', 'asc')
  }

  findById(id: string) {
    return this.query().where('id', id).first()
  }

  findByIdOrFail(id: string) {
    return this.query().where('id', id).firstOrFail()
  }

  findBySlug(slug: string) {
    return this.query().where('slug', slug).first()
  }

  slugExists(slug: string, trx?: TransactionClientContract) {
    return this.query(trx).where('slug', slug).first()
  }

  create(
    payload: {
      name: string
      slug: string
      document?: string | null
      status: TenantStatus
      plan?: string | null
      rbacVersion: number
    },
    trx?: TransactionClientContract
  ) {
    return Tenant.create(payload, clientOptions(trx))
  }
}

function clientOptions(trx?: TransactionClientContract) {
  return trx ? { client: trx } : undefined
}

export default new TenantRepository()
