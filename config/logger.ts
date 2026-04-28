import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, targets } from '@adonisjs/core/logger'

const loggerConfig = defineConfig({
  /**
   * Default logger used by ctx.logger and application services.
   */
  default: 'app',

  loggers: {
    app: {
      enabled: true,
      name: env.get('APP_NAME'),
      level: env.get('LOG_LEVEL'),
      transport: {
        targets: targets()
          .pushIf(!app.inProduction, targets.pretty())
          .pushIf(app.inProduction, targets.file({ destination: 'storage/logs/app.log' }))
          .toArray(),
      },
      redact: {
        paths: [
          'password',
          'secret',
          'token',
          '*.password',
          '*.secret',
          '*.token',
          'cpf',
          'cnpj',
          'document',
          '*.cpf',
          '*.cnpj',
          '*.document',
          'email',
          'phone',
          'telefone',
          '*.email',
          '*.phone',
          '*.telefone',
          'name_encrypted',
          'document_encrypted',
          'beneficiary.*',
          'beneficiaries.*',
          'beneficiario.*',
          'beneficiarios.*',
          'pii.*',
          'raw_data.beneficiarios',
          'raw_data.beneficiaries',
          'headers.authorization',
          'headers.cookie',
          'headers.set-cookie',
          'headers.x-api-key',
          'apiKey',
          'access_token',
          'refresh_token',
        ],
        remove: true,
      },
    },
  },
})

export default loggerConfig

declare module '@adonisjs/core/types' {
  export interface LoggersList extends InferLoggers<typeof loggerConfig> {}
}
