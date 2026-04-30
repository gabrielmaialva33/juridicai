/*
|--------------------------------------------------------------------------
| Worker entrypoint
|--------------------------------------------------------------------------
|
| Boots the AdonisJS application container and starts BullMQ workers without
| starting the HTTP server.
|
*/

await import('reflect-metadata')
const { Ignitor, prettyPrintError } = await import('@adonisjs/core')

const APP_ROOT = new URL('../', import.meta.url)

const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }

  return import(filePath)
}

const ignitor = new Ignitor(APP_ROOT, { importer: IMPORTER }).tap((app) => {
  app.booting(async () => {
    await import('#start/env')
  })
})

const app = ignitor.createApp('console')

try {
  await app.init()
  await app.boot()

  const loggerService = await import('@adonisjs/core/services/logger')
  const logger = loggerService.default
  const { bootWorkers, shutdownWorkers } = await import('#start/jobs')
  bootWorkers()

  logger.info('Worker process started')

  const shutdown = async () => {
    logger.info('Worker process stopping')
    await shutdownWorkers()
    await app.terminate()
  }

  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
} catch (error) {
  process.exitCode = 1
  prettyPrintError(error)
}
