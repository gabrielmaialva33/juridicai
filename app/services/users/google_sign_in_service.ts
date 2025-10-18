import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import firebaseService from '#services/firebase/firebase_service'
import UsersRepository from '#repositories/users_repository'
import CreateTenantService from '#services/tenants/create_tenant_service'
import JwtAuthTokensService from '#services/users/jwt_auth_tokens_service'
import AuthEventService from '#services/users/auth_event_service'
import User from '#models/user'
import { GenerateAuthTokensResponse } from '#services/users/jwt_auth_tokens_service'

interface GoogleSignInPayload {
  idToken: string
  tenantId?: string
}

type GoogleSignInResponse = User & {
  auth: GenerateAuthTokensResponse
}

@inject()
export default class GoogleSignInService {
  constructor(
    private usersRepository: UsersRepository,
    private createTenantService: CreateTenantService,
    private jwtAuthTokensService: JwtAuthTokensService
  ) {}

  async run({ idToken }: GoogleSignInPayload): Promise<GoogleSignInResponse> {
    const ctx = HttpContext.getOrFail()

    // 1. Verify Firebase ID token
    const decodedToken = await firebaseService.verifyIdToken(idToken)
    const { uid, email, name } = decodedToken

    if (!email) {
      throw new Error('Email not found in Firebase token')
    }

    // 2. Find existing user by firebase_uid or email
    let user = await this.usersRepository.findByFirebaseUid(uid)

    if (!user) {
      user = await this.usersRepository.findByEmail(email)

      // Link Firebase UID to existing user
      if (user) {
        await user.merge({ firebase_uid: uid }).save()
      }
    }

    // 3. Create new user if doesn't exist
    if (!user) {
      const fullName = name || email.split('@')[0] || 'User'

      user = await this.usersRepository.create({
        full_name: fullName,
        email,
        firebase_uid: uid,
        // Generate random password (won't be used for Firebase auth)
        password: Math.random().toString(36).substring(2, 15),
      })

      // Create tenant for new user
      await this.createTenantService.run({
        name: `${fullName}'s Organization`,
        subdomain: `user-${user.id}`,
        plan: 'free',
        owner_user_id: user.id,
      })

      // Emit user registered event
      AuthEventService.emitUserRegistered(user, 'google', false, ctx)
    }

    // Load relationships
    await user.load('roles')

    // 4. Generate JWT tokens (backend authentication)
    const auth = await this.jwtAuthTokensService.run({ userId: user.id })

    // 5. Emit login succeeded event
    const isAdmin = user.roles.some((role) => role.name === 'ADMIN' || role.name === 'ROOT')
    AuthEventService.emitLoginSucceeded(user, 'google', isAdmin, ctx)

    const userJson = user.toJSON()
    return { ...userJson, auth } as GoogleSignInResponse
  }
}
