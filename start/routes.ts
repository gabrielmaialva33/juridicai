/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import '#modules/auth/routes'
import '#modules/tenant/routes'
import '#modules/permission/routes'
import '#modules/siop/routes'
import '#modules/precatorios/routes'
import '#modules/debtors/routes'
import '#modules/pii/routes'
import '#modules/exports/routes'
import '#modules/maintenance/routes'
import '#modules/dashboard/routes'
import '#modules/admin/routes'
import '#modules/healthcheck/routes'
import '#modules/client_errors/routes'

router.on('/').renderInertia('home', {}).as('home')
