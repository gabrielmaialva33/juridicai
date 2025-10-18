/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { throttle } from '#start/limiter'

import router from '@adonisjs/core/services/router'

import '#routes/files/index'
import '#routes/roles/index'
import '#routes/tenants/index'
import '#routes/users/index'
import '#routes/users/session_routes'
import '#routes/permissions/index'
import '#routes/health/index'
import '#routes/clients/index'
import '#routes/cases/index'
import '#routes/deadlines/index'
import '#routes/documents/index'
import '#routes/case_events/index'
import '#routes/time_entries/index'
import '#routes/ai/index'

router
  .get('/version', async () => {
    const packageJsonPath = join(process.cwd(), 'package.json')
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))
    return {
      name: packageJson.name,
      description: packageJson.description,
      version: packageJson.version,
      author: packageJson.author,
      contributors: packageJson.contributors,
    }
  })
  .use(throttle)
router.on('/').renderInertia('home')
