import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const PrecatoriosController = () =>
  import('#modules/precatorios/controllers/precatorios_controller')

router
  .group(() => {
    router.get('precatorios', [PrecatoriosController, 'index']).as('index')
  })
  .as('precatorios')
  .use(middleware.auth())
  .use(middleware.tenant())
