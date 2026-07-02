import BaseRepository from '#shared/repositories/base_repository'
import JudicialProcessSignal, {
  type JudicialSignalPolarity,
} from '#modules/precatorios/models/judicial_process_signal'
import type { DateTime } from 'luxon'
import type { JsonRecord } from '#shared/types/model_enums'

class JudicialProcessSignalRepository extends BaseRepository<typeof JudicialProcessSignal> {
  constructor() {
    super(JudicialProcessSignal)
  }

  listByProcess(tenantId: string, processId: string) {
    return this.query(tenantId).where('process_id', processId).orderBy('detected_at', 'desc')
  }

  upsertSignal(
    tenantId: string,
    input: {
      processId: string
      movementId: string | null
      signalCode: string
      polarity: JudicialSignalPolarity
      confidence: number
      detectedAt: DateTime
      evidence: JsonRecord
      idempotencyKey: string
    }
  ) {
    return JudicialProcessSignal.updateOrCreate(
      {
        tenantId,
        idempotencyKey: input.idempotencyKey,
      },
      {
        tenantId,
        processId: input.processId,
        movementId: input.movementId,
        signalCode: input.signalCode,
        polarity: input.polarity,
        confidence: input.confidence,
        detectedAt: input.detectedAt,
        source: 'datajud',
        evidence: input.evidence,
        idempotencyKey: input.idempotencyKey,
      }
    )
  }
}

export default new JudicialProcessSignalRepository()
