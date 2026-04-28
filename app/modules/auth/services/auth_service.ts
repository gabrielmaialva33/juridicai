import User from '#modules/auth/models/user'
import userRepository from '#modules/auth/repositories/user_repository'

class AuthService {
  verifyCredentials(email: string, password: string) {
    return User.verifyCredentials(email, password)
  }

  createUser(payload: { fullName?: string | null; email: string; password: string }) {
    return userRepository.create(payload)
  }
}

export default new AuthService()
