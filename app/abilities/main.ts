/*
|--------------------------------------------------------------------------
| Bouncer abilities
|--------------------------------------------------------------------------
|
| You may export multiple abilities from this file and pre-register them
| when creating the Bouncer instance.
|
| Pre-registered policies and abilities can be referenced as a string by their
| name. Also they are must if want to perform authorization inside Edge
| templates.
|
*/

import { Bouncer } from '@adonisjs/bouncer'
import permissionCacheService from '#shared/services/permission_cache_service'
import tenantContext from '#shared/helpers/tenant_context'
import type User from '#modules/auth/models/user'
import type { PermissionSlug } from '#modules/permission/seeders_data'

export const hasPermission = Bouncer.ability(
  async (user: User, permission: PermissionSlug, tenantId?: string) => {
    const scopedTenantId = tenantId ?? tenantContext.get()?.tenantId

    if (!scopedTenantId) {
      return false
    }

    const permissions = await permissionCacheService.getPermissions(scopedTenantId, user.id)
    return permissions.has(permission)
  }
)
