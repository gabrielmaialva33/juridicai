import marketRateService from '#modules/market/services/market_rate_service'
import { enumOrNull, positiveInteger } from '#shared/helpers/request_filters'
import type { HttpContext } from '@adonisjs/core/http'

export default class MarketRatesController {
  async snapshot({ response }: HttpContext) {
    return response.ok(await marketRateService.latestSnapshot())
  }

  async syncBcb({ request, response }: HttpContext) {
    const query = request.qs()
    const seriesKey = enumOrNull(query.seriesKey, ['cdi', 'selic', 'ipca'])

    return response.ok(
      await marketRateService.syncFromBcb({
        seriesKeys: seriesKey ? [seriesKey] : undefined,
        limit: positiveInteger(query.limit, 12),
      })
    )
  }
}
