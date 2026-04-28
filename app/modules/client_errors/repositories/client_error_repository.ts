import ClientError from '#modules/client_errors/models/client_error'

class ClientErrorRepository {
  create(payload: Partial<ClientError>) {
    return ClientError.create(payload)
  }
}

export default new ClientErrorRepository()
