import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const DebtorsController = () => import('#modules/debtors/controllers/debtors_controller')

router
  .group(() => {
    router.get('debtors', [DebtorsController, 'index']).as('index')
  })
  .as('debtors')
  .use(middleware.auth())
  .use(middleware.tenant())
