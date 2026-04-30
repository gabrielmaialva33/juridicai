import router from '@adonisjs/core/services/router'

const ClientErrorsController = () =>
  import('#modules/client_errors/controllers/client_errors_controller')

router.post('client-errors', [ClientErrorsController, 'store']).as('client_errors.store')
