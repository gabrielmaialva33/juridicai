import { inject } from '@adonisjs/core'
import redis from '@adonisjs/redis/services/main'
import { DateTime } from 'luxon'
import Deadline from '#models/deadline'
import TenantContextService from '#services/tenants/tenant_context_service'

/**
 * Service for caching deadline data
 * Implements caching for frequently accessed deadline queries
 *
 * Caching strategies:
 * - Upcoming deadlines by tenant (TTL: 15 minutes)
 * - Fatal upcoming deadlines by tenant (TTL: 15 minutes)
 *
 * @example
 * const cachedDeadlines = await deadlineCacheService.getCachedUpcoming(tenantId, 7)
 * if (!cachedDeadlines) {
 *   const deadlines = await paginateDeadlineService.getUpcoming(7)
 *   await deadlineCacheService.cacheUpcoming(tenantId, 7, deadlines)
 * }
 */
@inject()
export default class DeadlineCacheService {
  private readonly CACHE_PREFIX = 'deadlines'
  private readonly UPCOMING_TTL = 900 // 15 minutes in seconds
  private readonly FATAL_TTL = 900 // 15 minutes in seconds

  /**
   * Cache upcoming deadlines for a tenant
   *
   * @param tenantId - The tenant UUID
   * @param days - Number of days to look ahead
   * @param deadlines - Array of upcoming deadlines
   */
  async cacheUpcoming(tenantId: string, days: number, deadlines: Deadline[]): Promise<void> {
    const key = this.UPCOMING_KEY(tenantId, days)
    const deadlineData = deadlines.map((d) => ({
      id: d.id,
      title: d.title,
      deadline_date: d.deadline_date.toISO(),
      internal_deadline_date: d.internal_deadline_date?.toISO() || null,
      status: d.status,
      is_fatal: d.is_fatal,
      case_id: d.case_id,
      responsible_id: d.responsible_id,
      tenant_id: d.tenant_id,
    }))

    await redis.setex(key, this.UPCOMING_TTL, JSON.stringify(deadlineData))
  }

  /**
   * Get cached upcoming deadlines for a tenant
   *
   * @param tenantId - The tenant UUID
   * @param days - Number of days to look ahead
   * @returns Array of deadlines or null if not cached
   */
  async getCachedUpcoming(tenantId: string, days: number): Promise<Deadline[] | null> {
    const key = this.UPCOMING_KEY(tenantId, days)
    const cached = await redis.get(key)

    if (!cached) {
      return null
    }

    try {
      const deadlineData = JSON.parse(cached)
      return deadlineData.map((d: any) => {
        const deadline = new Deadline()
        deadline.id = d.id
        deadline.title = d.title
        deadline.deadline_date = DateTime.fromISO(d.deadline_date)
        deadline.internal_deadline_date = d.internal_deadline_date
          ? DateTime.fromISO(d.internal_deadline_date)
          : null
        deadline.status = d.status
        deadline.is_fatal = d.is_fatal
        deadline.case_id = d.case_id
        deadline.responsible_id = d.responsible_id
        deadline.tenant_id = d.tenant_id
        return deadline
      })
    } catch (error) {
      await redis.del(key)
      return null
    }
  }

  /**
   * Cache fatal upcoming deadlines for a tenant
   *
   * @param tenantId - The tenant UUID
   * @param days - Number of days to look ahead
   * @param deadlines - Array of fatal upcoming deadlines
   */
  async cacheFatalUpcoming(tenantId: string, days: number, deadlines: Deadline[]): Promise<void> {
    const key = this.FATAL_UPCOMING_KEY(tenantId, days)
    const deadlineData = deadlines.map((d) => ({
      id: d.id,
      title: d.title,
      deadline_date: d.deadline_date.toISO(),
      internal_deadline_date: d.internal_deadline_date?.toISO() || null,
      status: d.status,
      case_id: d.case_id,
      responsible_id: d.responsible_id,
      tenant_id: d.tenant_id,
    }))

    await redis.setex(key, this.FATAL_TTL, JSON.stringify(deadlineData))
  }

  /**
   * Get cached fatal upcoming deadlines for a tenant
   *
   * @param tenantId - The tenant UUID
   * @param days - Number of days to look ahead
   * @returns Array of fatal deadlines or null if not cached
   */
  async getCachedFatalUpcoming(tenantId: string, days: number): Promise<Deadline[] | null> {
    const key = this.FATAL_UPCOMING_KEY(tenantId, days)
    const cached = await redis.get(key)

    if (!cached) {
      return null
    }

    try {
      const deadlineData = JSON.parse(cached)
      return deadlineData.map((d: any) => {
        const deadline = new Deadline()
        deadline.id = d.id
        deadline.title = d.title
        deadline.deadline_date = DateTime.fromISO(d.deadline_date)
        deadline.internal_deadline_date = d.internal_deadline_date
          ? DateTime.fromISO(d.internal_deadline_date)
          : null
        deadline.status = d.status
        deadline.is_fatal = true
        deadline.case_id = d.case_id
        deadline.responsible_id = d.responsible_id
        deadline.tenant_id = d.tenant_id
        return deadline
      })
    } catch (error) {
      await redis.del(key)
      return null
    }
  }

  /**
   * Invalidate all deadline caches for a tenant
   * Use when deadlines are created, updated, or deleted
   *
   * @param tenantId - The tenant UUID
   */
  async invalidateTenantCache(tenantId: string): Promise<void> {
    const pattern = `${this.CACHE_PREFIX}:${tenantId}:*`
    const keys = await redis.keys(pattern)

    if (keys.length > 0) {
      await redis.del(...keys)
    }
  }

  /**
   * Invalidate cache for current tenant (from context)
   * Convenience method that reads tenant from AsyncLocalStorage
   */
  async invalidateCurrentTenantCache(): Promise<void> {
    const tenantId = TenantContextService.assertTenantId()
    await this.invalidateTenantCache(tenantId)
  }

  /**
   * Get cache statistics for monitoring
   *
   * @returns Cache stats including total keys and breakdown by type
   */
  async getCacheStats(): Promise<{
    totalKeys: number
    upcomingKeys: number
    fatalKeys: number
  }> {
    const allKeys = await redis.keys(`${this.CACHE_PREFIX}:*`)

    const upcomingKeys = allKeys.filter(
      (key) => key.includes(':upcoming:') && !key.includes(':fatal:')
    ).length
    const fatalKeys = allKeys.filter((key) => key.includes(':fatal:')).length

    return {
      totalKeys: allKeys.length,
      upcomingKeys,
      fatalKeys,
    }
  }

  /**
   * Clear all deadline cache across all tenants
   * Use with caution - typically for maintenance or testing
   */
  async clearAllCache(): Promise<void> {
    const pattern = `${this.CACHE_PREFIX}:*`
    const keys = await redis.keys(pattern)

    if (keys.length > 0) {
      await redis.del(...keys)
    }
  }

  /**
   * Cache key generators
   */
  private readonly UPCOMING_KEY = (tenantId: string, days: number) =>
    `${this.CACHE_PREFIX}:${tenantId}:upcoming:${days}`

  private readonly FATAL_UPCOMING_KEY = (tenantId: string, days: number) =>
    `${this.CACHE_PREFIX}:${tenantId}:fatal:upcoming:${days}`
}
