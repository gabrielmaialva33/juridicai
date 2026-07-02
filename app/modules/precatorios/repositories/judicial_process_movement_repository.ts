import BaseRepository from '#shared/repositories/base_repository'
import JudicialProcessMovement from '#modules/precatorios/models/judicial_process_movement'

class JudicialProcessMovementRepository extends BaseRepository<typeof JudicialProcessMovement> {
  constructor() {
    super(JudicialProcessMovement)
  }

  listForSignalClassification(
    tenantId: string,
    options: {
      limit: number
      processId?: string | null
    }
  ) {
    const query = this.query(tenantId)
      .preload('process')
      .preload('complements')
      .orderBy('occurred_at', 'desc')
      .orderBy('created_at', 'desc')
      .limit(options.limit)

    if (options.processId) {
      query.where('process_id', options.processId)
    }

    return query
  }
}

export default new JudicialProcessMovementRepository()
