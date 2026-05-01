import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const MarketRatesController = () => import('#modules/market/controllers/market_rates_controller')

router
  .group(() => {
    router
      .get('market/rates/snapshot', [MarketRatesController, 'snapshot'])
      .as('rates.snapshot')
      .use(middleware.permission('market.read'))
    router
      .post('market/rates/sync-bcb', [MarketRatesController, 'syncBcb'])
      .as('rates.sync_bcb')
      .use(middleware.permission('market.manage'))
  })
  .as('market')
  .use(middleware.auth())
  .use(middleware.tenant())
