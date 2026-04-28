import type TenantModel from '#shared/models/tenant_model'
import TenantBaseModel from '#shared/models/tenant_base_model'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'

export type Attributes<Model extends typeof TenantModel> = ModelAttributes<InstanceType<Model>>

/**
 * Tenant-scoped repository base.
 *
 * Domain repositories should expose queries through this class so tenant
 * isolation is applied consistently before any domain-specific filters.
 */
export default class BaseRepository<Model extends typeof TenantModel> {
  constructor(protected model: Model) {}

  query(tenantId: string) {
    const query = this.model.query().where('tenant_id', tenantId)

    if (this.hasSoftDelete()) {
      query.whereNull('deleted_at')
    }

    return query
  }

  unscopedQuery(tenantId: string) {
    return this.model.query().where('tenant_id', tenantId)
  }

  async findAll(tenantId: string) {
    return this.query(tenantId).exec()
  }

  async paginate(tenantId: string, page = 1, perPage = 15) {
    return this.query(tenantId).paginate(page, perPage)
  }

  async findById(tenantId: string, id: string) {
    return this.query(tenantId).where('id', id).first()
  }

  async findByIdOrFail(tenantId: string, id: string) {
    return this.query(tenantId).where('id', id).firstOrFail()
  }

  async findBy(tenantId: string, key: string, value: string | number | boolean | null) {
    return this.query(tenantId)
      .where(key, value as string)
      .first()
  }

  async create(
    tenantId: string,
    payload: Partial<Attributes<Model>>
  ): Promise<InstanceType<Model>> {
    return this.model.create({ ...payload, tenantId } as any) as unknown as InstanceType<Model>
  }

  async createMany(
    tenantId: string,
    payloads: Partial<Attributes<Model>>[]
  ): Promise<InstanceType<Model>[]> {
    const rows = payloads.map((payload) => ({ ...payload, tenantId }))
    return this.model.createMany(rows as any) as unknown as InstanceType<Model>[]
  }

  async update(
    tenantId: string,
    id: string,
    payload: Partial<Attributes<Model>>
  ): Promise<InstanceType<Model>> {
    const row = await this.findByIdOrFail(tenantId, id)
    ;(row as any).merge(payload)
    await (row as any).save()
    return row
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const row = await this.findByIdOrFail(tenantId, id)

    if (row instanceof TenantBaseModel) {
      await row.softDelete()
      return
    }

    await (row as any).delete()
  }

  async forceDelete(tenantId: string, id: string): Promise<void> {
    const row = await this.unscopedQuery(tenantId).where('id', id).firstOrFail()
    await (row as any).delete()
  }

  async restore(tenantId: string, id: string): Promise<InstanceType<Model>> {
    const row = await this.unscopedQuery(tenantId).where('id', id).firstOrFail()

    if (row instanceof TenantBaseModel) {
      row.deletedAt = null
      await row.save()
    }

    return row as InstanceType<Model>
  }

  async exists(
    tenantId: string,
    key: string,
    value: string | number | boolean | null,
    excludeId?: string
  ): Promise<boolean> {
    const query = this.query(tenantId).where(key, value as string)

    if (excludeId) {
      query.whereNot('id', excludeId)
    }

    return !!(await query.first())
  }

  async count(tenantId: string): Promise<number> {
    const result = await this.query(tenantId).count('* as total')
    return Number((result[0] as any)?.$extras?.total ?? 0)
  }

  protected hasSoftDelete(): boolean {
    return this.model.prototype instanceof TenantBaseModel
  }
}
