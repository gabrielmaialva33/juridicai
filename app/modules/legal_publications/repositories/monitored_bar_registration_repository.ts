import BaseRepository from '#shared/repositories/base_repository'
import MonitoredBarRegistration from '#modules/legal_publications/models/monitored_bar_registration'

export type MonitoredBarRegistrationPayload = {
  barNumber: string
  stateCode: string
  lawyerName: string | null
  userId?: string | null
}

class MonitoredBarRegistrationRepository extends BaseRepository<typeof MonitoredBarRegistration> {
  constructor() {
    super(MonitoredBarRegistration)
  }

  listForMonitoring(tenantId: string) {
    return this.query(tenantId).orderBy('active', 'desc').orderBy('created_at', 'desc')
  }

  findDuplicate(tenantId: string, barNumber: string, stateCode: string, excludeId?: string) {
    const query = this.query(tenantId).where('bar_number', barNumber).where('state_code', stateCode)

    if (excludeId) {
      query.whereNot('id', excludeId)
    }

    return query.first()
  }

  async createForMonitoring(tenantId: string, payload: MonitoredBarRegistrationPayload) {
    return this.create(tenantId, {
      barNumber: payload.barNumber,
      stateCode: payload.stateCode,
      lawyerName: payload.lawyerName,
      userId: payload.userId ?? null,
      active: true,
    })
  }

  async updateForMonitoring(
    tenantId: string,
    id: string,
    payload: MonitoredBarRegistrationPayload
  ) {
    const registration = await this.findByIdOrFail(tenantId, id)
    registration.merge({
      barNumber: payload.barNumber,
      stateCode: payload.stateCode,
      lawyerName: payload.lawyerName,
      userId: payload.userId ?? null,
    })
    await registration.save()
    return registration
  }

  async setActive(tenantId: string, id: string, active: boolean) {
    const registration = await this.findByIdOrFail(tenantId, id)
    registration.active = active
    await registration.save()
    return registration
  }
}

export default new MonitoredBarRegistrationRepository()
