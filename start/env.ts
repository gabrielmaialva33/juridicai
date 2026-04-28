/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),

  // App
  APP_KEY: Env.schema.secret(),
  APP_NAME: Env.schema.string(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const),

  // Session
  SESSION_DRIVER: Env.schema.enum(['cookie', 'redis', 'memory'] as const),

  // Database
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  // Redis
  REDIS_HOST: Env.schema.string({ format: 'host' }),
  REDIS_PORT: Env.schema.number(),
  REDIS_PASSWORD: Env.schema.secret.optional(),

  // PII bunker
  PII_HASH_PEPPER: Env.schema.string(),
  PII_ENCRYPTION_KEY: Env.schema.string(),

  // Drive
  DRIVE_DISK: Env.schema.enum(['fs'] as const),
})
