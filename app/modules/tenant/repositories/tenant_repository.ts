import Tenant from '#modules/tenant/models/tenant'

class TenantRepository {
  query() {
    return Tenant.query()
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
}

export default new TenantRepository()
