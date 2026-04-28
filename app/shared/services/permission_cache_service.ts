import db from '@adonisjs/lucid/services/db'

type CacheEntry = {
  permissions: Set<string>
  expiresAt: number
}

const CACHE_TTL_MS = 5 * 60 * 1000

class PermissionCacheService {
  #cache = new Map<string, CacheEntry>()

  async getPermissions(tenantId: string, userId: string) {
    const cacheKey = `${tenantId}:${userId}`
    const cached = this.#cache.get(cacheKey)

    if (cached && cached.expiresAt > Date.now()) {
      return cached.permissions
    }

    const rows = await db
      .from('user_roles')
      .join('role_permissions', 'role_permissions.role_id', 'user_roles.role_id')
      .join('permissions', 'permissions.id', 'role_permissions.permission_id')
      .where('user_roles.tenant_id', tenantId)
      .where('user_roles.user_id', userId)
      .select('permissions.slug')

    const permissions = new Set(rows.map((row) => row.slug as string))
    this.#cache.set(cacheKey, { permissions, expiresAt: Date.now() + CACHE_TTL_MS })

    return permissions
  }

  invalidate(tenantId: string, userId: string) {
    this.#cache.delete(`${tenantId}:${userId}`)
  }

  invalidateAll() {
    this.#cache.clear()
  }
}

export default new PermissionCacheService()
