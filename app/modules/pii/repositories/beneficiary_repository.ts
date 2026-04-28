import BaseRepository from '#shared/repositories/base_repository'
import Beneficiary from '#modules/pii/models/beneficiary'

class BeneficiaryRepository extends BaseRepository<typeof Beneficiary> {
  constructor() {
    super(Beneficiary)
  }

  findByHash(tenantId: string, beneficiaryHash: string) {
    return this.query(tenantId).where('beneficiary_hash', beneficiaryHash).first()
  }
}

export default new BeneficiaryRepository()
