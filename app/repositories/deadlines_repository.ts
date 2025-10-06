import Deadline from '#models/deadline'
import LucidRepository from '#shared/lucid/lucid_repository'

export default class DeadlinesRepository extends LucidRepository<typeof Deadline> {
  model = Deadline
}
