import Permission from '#modules/permission/models/permission'

class PermissionRepository {
  query() {
    return Permission.query()
  }

  list() {
    return this.query().orderBy('slug', 'asc')
  }

  findBySlug(slug: string) {
    return this.query().where('slug', slug).first()
  }
}

export default new PermissionRepository()
