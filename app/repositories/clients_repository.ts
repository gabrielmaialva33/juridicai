import Client from '#models/client'
import LucidRepository from '#shared/lucid/lucid_repository'

export default class ClientsRepository extends LucidRepository<typeof Client> {
  model = Client
}
