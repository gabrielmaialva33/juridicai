import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import firebaseService from '#services/firebase/firebase_service'
import UsersRepository from '#repositories/users_repository'
import TenantsRepository from '#repositories/tenants_repository'
import TenantUsersRepository from '#repositories/tenant_users_repository'
import JwtAuthTokensService from '#services/users/jwt_auth_tokens_service'
import AuthEventService from '#services/users/auth_event_service'
import TenantContextService from '#services/tenants/tenant_context_service'
import User from '#models/user'
import { TenantUserRole } from '#models/tenant_user'
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
    private tenantsRepository: TenantsRepository,
    private tenantUsersRepository: TenantUsersRepository,
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

      // Create tenant FIRST (user needs tenant_id due to TenantScoped mixin)
      const tenant = await this.tenantsRepository.create({
        name: `${fullName}'s Organization`,
        subdomain: `temp-${uid.substring(0, 8)}`, // Temporary subdomain, will update after user creation
        plan: 'free',
        is_active: true,
        limits: null,
        trial_ends_at: DateTime.now().plus({ days: 14 }), // 14 day trial
      })

      // Now create user with tenant_id
      user = await this.usersRepository.create({
        full_name: fullName,
        email,
        firebase_uid: uid,
        tenant_id: tenant.id,
        // Generate random password (won't be used for Firebase auth)
        password: Math.random().toString(36).substring(2, 15),
      })

      // Update tenant subdomain with user ID
      await tenant.merge({ subdomain: `user-${user.id}` }).save()

      // Create tenant-user relationship (OWNER role)
      await this.tenantUsersRepository.create({
        tenant_id: tenant.id,
        user_id: user.id,
        role: TenantUserRole.OWNER,
        is_active: true,
        invited_at: DateTime.now(),
        joined_at: DateTime.now(),
      })

      // Emit user registered event
      AuthEventService.emitUserRegistered(user, 'oauth', false, ctx)
    }

    // Establish tenant context for subsequent queries
    const result = await TenantContextService.run(
      {
        tenant_id: user.tenant_id,
        tenant: null,
        user_id: user.id,
        tenant_user: null,
      },
      async () => {
        // Load relationships within tenant context
        await user.load('roles')

        // 4. Generate JWT tokens (backend authentication)
        const auth = await this.jwtAuthTokensService.run({ userId: user.id })

        // 5. Emit login succeeded event
        const isAdmin = user.roles.some((role) => role.name === 'ADMIN' || role.name === 'ROOT')
        AuthEventService.emitLoginSucceeded(user, 'oauth', isAdmin, ctx)

        const userJson = user.toJSON()
        return { ...userJson, auth } as GoogleSignInResponse
      }
    )

    return result
  }
}
