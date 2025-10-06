import Case from '#models/case'
import LucidRepository from '#shared/lucid/lucid_repository'

export default class CasesRepository extends LucidRepository<typeof Case> {
  model = Case
}
