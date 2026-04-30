import { randomUUID } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class RequestIdMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const requestId = ctx.request.header('x-request-id') || randomUUID()
    ctx.requestId = requestId
    ctx.response.header('x-request-id', requestId)

    return next()
  }
}

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    requestId: string
  }
}
