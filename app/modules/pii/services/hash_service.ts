import { createHmac } from 'node:crypto'
import env from '#start/env'

class HashService {
  beneficiaryHash(normalizedKey: string) {
    return createHmac('sha256', env.get('PII_HASH_PEPPER')).update(normalizedKey).digest('hex')
  }
}

export default new HashService()
