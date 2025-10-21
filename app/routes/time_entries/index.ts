import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const TimeEntriesController = () => import('#controllers/time_entries/time_entries_controller')

// Inertia page route - TEMPORARILY PUBLIC for testing
router.get('/time-entries', async ({ inertia }) => {
  return inertia.render('time-entries/index')
}).as('time_entries.page')

router
  .group(() => {
    // Timer controls
    router.post('/time-entries/start', [TimeEntriesController, 'start']).as('time_entries.start')

    router
      .post('/time-entries/:id/stop', [TimeEntriesController, 'stop'])
      .where('id', /^\d+$/)
      .as('time_entries.stop')

    // CRUD operations
    router.post('/time-entries', [TimeEntriesController, 'store']).as('time_entries.store')

    router.get('/time-entries', [TimeEntriesController, 'index']).as('time_entries.index')

    router
      .patch('/time-entries/:id', [TimeEntriesController, 'update'])
      .where('id', /^\d+$/)
      .as('time_entries.update')

    router
      .delete('/time-entries/:id', [TimeEntriesController, 'destroy'])
      .where('id', /^\d+$/)
      .as('time_entries.destroy')

    // Stats
    router.get('/time-entries/stats', [TimeEntriesController, 'stats']).as('time_entries.stats')
  })
  .prefix('/api/v1')
  .use([middleware.auth(), middleware.tenant()])
