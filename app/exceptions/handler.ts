import app from '@adonisjs/core/services/app'
import { ExceptionHandler, HttpContext } from '@adonisjs/core/http'
import type { StatusPageRange, StatusPageRenderer } from '@adonisjs/core/types/http'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * Status pages are used to display a custom HTML pages for certain error
   * codes. You might want to enable them in production only, but feel
   * free to enable them in development as well.
   */
  protected renderStatusPages = app.inProduction

  /**
   * Status pages is a collection of error code range and a callback
   * to return the HTML contents to send as a response.
   * Disabled for API-only application.
   */
  protected statusPages: Record<StatusPageRange, StatusPageRenderer> = {}

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: unknown, ctx: HttpContext) {
    /**
     * Handle validation errors from VineJS
     */
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'E_VALIDATION_ERROR'
    ) {
      const validationError = error
      const messages = 'messages' in validationError ? validationError.messages : []
      const acceptType = ctx.request.accepts(['html', 'json'])

      // Always return JSON for API routes
      if (acceptType === 'json' || ctx.request.url().startsWith('/api/')) {
        return ctx.response.status(422).json({
          errors: messages || [],
        })
      }

      ctx.session.flashAll()
      ctx.session.flash('errors', messages || {})
      return ctx.response.redirect().back()
    }

    /**
     * Handle rate limiting errors
     */
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'E_TOO_MANY_REQUESTS'
    ) {
      const rateLimitError = error

      // Set rate limit headers from the response object
      if (
        'response' in rateLimitError &&
        rateLimitError.response &&
        typeof rateLimitError.response === 'object'
      ) {
        const response = rateLimitError.response
        if (
          'limit' in response &&
          (typeof response.limit === 'string' || typeof response.limit === 'number')
        ) {
          ctx.response.header('x-ratelimit-limit', response.limit)
        }
        if (
          'remaining' in response &&
          (typeof response.remaining === 'string' || typeof response.remaining === 'number')
        ) {
          ctx.response.header('x-ratelimit-remaining', response.remaining)
        }
        if (
          'availableIn' in response &&
          (typeof response.availableIn === 'string' || typeof response.availableIn === 'number')
        ) {
          ctx.response.header('retry-after', response.availableIn)
        }
      }

      const message =
        'message' in rateLimitError && typeof rateLimitError.message === 'string'
          ? rateLimitError.message
          : 'Too many requests'

      return ctx.response.status(429).json({
        errors: [
          {
            code: 'E_TOO_MANY_REQUESTS',
            message,
            status: 429,
          },
        ],
      })
    }

    return super.handle(error, ctx)
  }

  /**
   * The method is used to report error to the logging service or
   * the a third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
