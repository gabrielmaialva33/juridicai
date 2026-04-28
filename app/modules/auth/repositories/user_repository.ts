import User from '#modules/auth/models/user'

class UserRepository {
  query() {
    return User.query()
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

  async create(payload: { fullName?: string | null; email: string; password: string }) {
    return User.create(payload)
  }
}

export default new UserRepository()
