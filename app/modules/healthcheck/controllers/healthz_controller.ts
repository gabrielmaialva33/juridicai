import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import type { HttpContext } from '@adonisjs/core/http'

export default class HealthzController {
  async show({ response }: HttpContext) {
    await db.rawQuery('select 1')
    await redis.ping()

    return response.ok({ status: 'ok' })
  }
}
