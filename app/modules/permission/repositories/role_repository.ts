import Role from '#modules/permission/models/role'

class RoleRepository {
  query() {
    return Role.query()
  }

  list() {
    return this.query().orderBy('slug', 'asc')
  }

  findBySlug(slug: string) {
    return this.query().where('slug', slug).first()
  }
}

export default new RoleRepository()
