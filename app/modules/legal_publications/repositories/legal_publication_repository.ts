import BaseRepository from '#shared/repositories/base_repository'
import LegalPublication, {
  type LegalPublicationOrigin,
} from '#modules/legal_publications/models/legal_publication'
import type { DateTime } from 'luxon'
import type { JsonRecord } from '#shared/types/model_enums'

export type LegalPublicationPersistencePayload = {
  judicialProcessId: string | null
  precatorioAssetId: string | null
  monitoredCaseId: string | null
  monitoredBarRegistrationId: string | null
  djenId: string
  processNumber: string
  courtAlias: string | null
  communicationType: string | null
  courtBody: string | null
  judicialClass: string | null
  link: string | null
  matchedBarRegistration: string | null
  origin: LegalPublicationOrigin
  body: string
  textHash: string | null
  rawData: JsonRecord | null
  availableAt: DateTime | null
  publishedAt: DateTime | null
}

class LegalPublicationRepository extends BaseRepository<typeof LegalPublication> {
  constructor() {
    super(LegalPublication)
  }

  listRecent(tenantId: string, limit = 50) {
    return this.query(tenantId).orderBy('available_at', 'desc').limit(limit)
  }

  findByDjenId(tenantId: string, djenId: string) {
    return this.query(tenantId).where('djen_id', djenId).first()
  }

  async saveFromDjen(
    tenantId: string,
    publication: LegalPublication | null,
    payload: LegalPublicationPersistencePayload
  ) {
    const row = publication ?? new LegalPublication()
    row.merge({ ...payload, tenantId })
    await row.save()
    return row
  }
}

export default new LegalPublicationRepository()
