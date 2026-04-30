import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { PermissionSlug } from '#modules/permission/seeders_data'

type PermissionRequirement =
  | PermissionSlug
  | PermissionSlug[]
  | {
      all?: PermissionSlug[]
      any?: PermissionSlug[]
    }

export default class PermissionMiddleware {
  async handle(ctx: HttpContext, next: NextFn, requirement?: PermissionRequirement) {
    const permissions = this.normalizeRequirement(requirement)

    if (permissions.all.length === 0 && permissions.any.length === 0) {
      return next()
    }

    if (!ctx.auth.user) {
      return ctx.response.status(401).send({
        code: 'E_UNAUTHORIZED',
        message: 'Authentication is required before checking permissions.',
      })
    }

    if (!ctx.tenant?.id) {
      return ctx.response.status(400).send({
        code: 'E_TENANT_REQUIRED',
        message: 'A tenant context is required for this action.',
      })
    }

    const hasAll = await this.allowsAll(ctx, permissions.all)
    const hasAny = permissions.any.length === 0 || (await this.allowsAny(ctx, permissions.any))

    if (!hasAll || !hasAny) {
      return ctx.response.status(403).send({
        code: 'E_PERMISSION_DENIED',
        message: 'You do not have permission to perform this action.',
      })
    }

    return next()
  }

  private normalizeRequirement(requirement?: PermissionRequirement) {
    if (!requirement) {
      return { all: [] as PermissionSlug[], any: [] as PermissionSlug[] }
    }

    if (typeof requirement === 'string') {
      return { all: [requirement], any: [] as PermissionSlug[] }
    }

    if (Array.isArray(requirement)) {
      return { all: requirement, any: [] as PermissionSlug[] }
    }

    return {
      all: requirement.all ?? [],
      any: requirement.any ?? [],
    }
  }

  private async allowsAll(ctx: HttpContext, permissions: PermissionSlug[]) {
    for (const permission of permissions) {
      if (!(await ctx.bouncer.allows('hasPermission', permission, ctx.tenant!.id))) {
        return false
      }
    }

    return true
  }

  private async allowsAny(ctx: HttpContext, permissions: PermissionSlug[]) {
    for (const permission of permissions) {
      if (await ctx.bouncer.allows('hasPermission', permission, ctx.tenant!.id)) {
        return true
      }
    }

    return false
  }
}
