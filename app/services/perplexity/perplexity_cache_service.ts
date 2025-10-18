import { inject } from '@adonisjs/core'
import redis from '@adonisjs/redis/services/main'
import env from '#start/env'
import { createHash } from 'node:crypto'
import logger from '@adonisjs/core/services/logger'
import IPerplexity from '#interfaces/perplexity_interface'

/**
 * Perplexity Cache Service
 *
 * Caches Perplexity AI responses to reduce API costs and improve response times
 * Uses Redis for distributed caching with configurable TTL
 *
 * @class PerplexityCacheService
 * @example
 * const cache = await app.container.make(PerplexityCacheService)
 * const cached = await cache.get(query, 'legal_research')
 * if (!cached) {
 *   const response = await perplexityClient.search(...)
 *   await cache.set(query, 'legal_research', response)
 * }
 */
@inject()
export default class PerplexityCacheService {
  private readonly keyPrefix = 'perplexity:cache'
  private readonly ttl: number

  constructor() {
    this.ttl = env.get('PERPLEXITY_CACHE_TTL', 86400) // 24 hours default
  }

  /**
   * Get cached response for a query
   *
   * @param query - The search query
   * @param searchType - Type of search
   * @param metadata - Optional metadata for cache key generation
   * @returns Cached response or null if not found
   */
  async get(
    query: string,
    searchType: IPerplexity.SearchType,
    metadata?: Record<string, any>
  ): Promise<IPerplexity.PerplexityResponse | null> {
    try {
      const cacheKey = this.generateCacheKey(query, searchType, metadata)
      const cached = await redis.get(cacheKey)

      if (!cached) {
        logger.debug('Cache miss', { search_type: searchType })
        return null
      }

      logger.info('Cache hit', { search_type: searchType })
      return JSON.parse(cached)
    } catch (error) {
      logger.error('Cache get error', { error: error.message })
      return null // Fail gracefully
    }
  }

  /**
   * Store response in cache
   *
   * @param query - The search query
   * @param searchType - Type of search
   * @param response - Response to cache
   * @param metadata - Optional metadata for cache key generation
   * @param customTtl - Optional custom TTL in seconds
   */
  async set(
    query: string,
    searchType: IPerplexity.SearchType,
    response: IPerplexity.PerplexityResponse,
    metadata?: Record<string, any>,
    customTtl?: number
  ): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(query, searchType, metadata)
      const ttl = customTtl || this.ttl

      await redis.setex(cacheKey, ttl, JSON.stringify(response))

      logger.info('Response cached', {
        search_type: searchType,
        ttl,
        cache_key_hash: cacheKey.slice(-8),
      })
    } catch (error) {
      logger.error('Cache set error', { error: error.message })
      // Fail gracefully - don't block the main flow
    }
  }

  /**
   * Invalidate cache for a specific query
   *
   * @param query - The search query
   * @param searchType - Type of search
   * @param metadata - Optional metadata for cache key generation
   */
  async invalidate(
    query: string,
    searchType: IPerplexity.SearchType,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(query, searchType, metadata)
      await redis.del(cacheKey)

      logger.info('Cache invalidated', {
        search_type: searchType,
      })
    } catch (error) {
      logger.error('Cache invalidation error', { error: error.message })
    }
  }

  /**
   * Invalidate all Perplexity caches for current tenant
   *
   * @param tenantId - Tenant ID to invalidate caches for
   */
  async invalidateAllForTenant(tenantId: string): Promise<void> {
    try {
      const pattern = `${this.keyPrefix}:${tenantId}:*`
      const keys = await redis.keys(pattern)

      if (keys.length > 0) {
        await redis.del(...keys)
        logger.info('All caches invalidated for tenant', {
          tenant_id: tenantId,
          count: keys.length,
        })
      }
    } catch (error) {
      logger.error('Bulk cache invalidation error', { error: error.message })
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  async getStats(tenantId: string): Promise<{
    total_keys: number
    estimated_size_kb: number
  }> {
    try {
      const pattern = `${this.keyPrefix}:${tenantId}:*`
      const keys = await redis.keys(pattern)

      // Estimate size (rough approximation)
      let totalSize = 0
      for (const key of keys.slice(0, 100)) {
        // Sample first 100 keys
        const value = await redis.get(key)
        if (value) {
          totalSize += Buffer.byteLength(value, 'utf8')
        }
      }

      const avgSize = keys.length > 0 ? totalSize / Math.min(keys.length, 100) : 0
      const estimatedTotalSize = avgSize * keys.length

      return {
        total_keys: keys.length,
        estimated_size_kb: Math.round(estimatedTotalSize / 1024),
      }
    } catch (error) {
      logger.error('Cache stats error', { error: error.message })
      return { total_keys: 0, estimated_size_kb: 0 }
    }
  }

  /**
   * Generate cache key from query, type, and metadata
   * Uses tenant ID for multi-tenant isolation
   */
  private generateCacheKey(
    query: string,
    searchType: IPerplexity.SearchType,
    metadata?: Record<string, any>
  ): string {
    // Import tenant context dynamically to avoid circular deps
    const TenantContextService = require('#services/tenants/tenant_context_service').default
    const tenantContext = TenantContextService.get()
    const tenantId = tenantContext.tenant_id || 'global'

    // Create deterministic hash of query + metadata
    const queryData = {
      query: query.trim().toLowerCase(),
      search_type: searchType,
      ...metadata,
    }

    const hash = createHash('sha256').update(JSON.stringify(queryData)).digest('hex').slice(0, 16)

    return `${this.keyPrefix}:${tenantId}:${searchType}:${hash}`
  }
}
