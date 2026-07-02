import BaseRepository from '#shared/repositories/base_repository'
import MonitoredCase from '#modules/legal_publications/models/monitored_case'
import type { ClientPartySide } from '#modules/legal_publications/models/monitored_case'

export type MonitoredCasePayload = {
  cnjNumber: string
  label: string | null
  clientPartySide: ClientPartySide | null
  monitoredBarRegistrationId?: string | null
}

class MonitoredCaseRepository extends BaseRepository<typeof MonitoredCase> {
  constructor() {
    super(MonitoredCase)
  }

  listForMonitoring(tenantId: string) {
    return this.query(tenantId)
      .preload('monitoredBarRegistration')
      .orderBy('active', 'desc')
      .orderBy('created_at', 'desc')
  }

  findDuplicate(tenantId: string, cnjNumber: string, excludeId?: string) {
    const query = this.query(tenantId).where('cnj_number', cnjNumber)

    if (excludeId) {
      query.whereNot('id', excludeId)
    }

    return query.first()
  }

  async createForMonitoring(tenantId: string, payload: MonitoredCasePayload) {
    return this.create(tenantId, {
      cnjNumber: payload.cnjNumber,
      label: payload.label,
      clientPartySide: payload.clientPartySide,
      monitoredBarRegistrationId: payload.monitoredBarRegistrationId ?? null,
      active: true,
    })
  }

  async updateForMonitoring(tenantId: string, id: string, payload: MonitoredCasePayload) {
    const monitoredCase = await this.findByIdOrFail(tenantId, id)
    monitoredCase.merge({
      cnjNumber: payload.cnjNumber,
      label: payload.label,
      clientPartySide: payload.clientPartySide,
      monitoredBarRegistrationId: payload.monitoredBarRegistrationId ?? null,
    })
    await monitoredCase.save()
    return monitoredCase
  }

  async setActive(tenantId: string, id: string, active: boolean) {
    const monitoredCase = await this.findByIdOrFail(tenantId, id)
    monitoredCase.active = active
    await monitoredCase.save()
    return monitoredCase
  }
}

export default new MonitoredCaseRepository()
