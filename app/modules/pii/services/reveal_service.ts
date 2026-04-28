import db from '@adonisjs/lucid/services/db'
import env from '#start/env'

class RevealService {
  async revealBeneficiary(tenantId: string, userId: string, beneficiaryId: string) {
    const result = await db.rawQuery('select * from pii.reveal_beneficiary(?, ?, ?, ?)', [
      tenantId,
      userId,
      beneficiaryId,
      env.get('PII_ENCRYPTION_KEY'),
    ])

    return result.rows[0] ?? null
  }
}

export default new RevealService()
