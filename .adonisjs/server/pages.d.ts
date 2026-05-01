import '@adonisjs/inertia/types'

import type React from 'react'
import type { Prettify } from '@adonisjs/core/types/common'

type ExtractProps<T> =
  T extends React.FC<infer Props>
    ? Prettify<Omit<Props, 'children'>>
    : T extends React.Component<infer Props>
      ? Prettify<Omit<Props, 'children'>>
      : never

declare module '@adonisjs/inertia/types' {
  export interface InertiaPages {
    'admin/health': ExtractProps<(typeof import('../../inertia/pages/admin/health.tsx'))['default']>
    'admin/jobs': ExtractProps<(typeof import('../../inertia/pages/admin/jobs.tsx'))['default']>
    'auth/login': ExtractProps<(typeof import('../../inertia/pages/auth/login.tsx'))['default']>
    'auth/signup': ExtractProps<(typeof import('../../inertia/pages/auth/signup.tsx'))['default']>
    'dashboard/index': ExtractProps<(typeof import('../../inertia/pages/dashboard/index.tsx'))['default']>
    'debtors/index': ExtractProps<(typeof import('../../inertia/pages/debtors/index.tsx'))['default']>
    'debtors/show': ExtractProps<(typeof import('../../inertia/pages/debtors/show.tsx'))['default']>
    'errors/not_found': ExtractProps<(typeof import('../../inertia/pages/errors/not_found.tsx'))['default']>
    'errors/server_error': ExtractProps<(typeof import('../../inertia/pages/errors/server_error.tsx'))['default']>
    'operations/desk': ExtractProps<(typeof import('../../inertia/pages/operations/desk.tsx'))['default']>
    'operations/opportunities': ExtractProps<(typeof import('../../inertia/pages/operations/opportunities.tsx'))['default']>
    'operations/pipeline': ExtractProps<(typeof import('../../inertia/pages/operations/pipeline.tsx'))['default']>
    'operations/show': ExtractProps<(typeof import('../../inertia/pages/operations/show.tsx'))['default']>
    'precatorios/index': ExtractProps<(typeof import('../../inertia/pages/precatorios/index.tsx'))['default']>
    'precatorios/show': ExtractProps<(typeof import('../../inertia/pages/precatorios/show.tsx'))['default']>
    'profile/show': ExtractProps<(typeof import('../../inertia/pages/profile/show.tsx'))['default']>
    'settings/tenant': ExtractProps<(typeof import('../../inertia/pages/settings/tenant.tsx'))['default']>
    'settings/users': ExtractProps<(typeof import('../../inertia/pages/settings/users.tsx'))['default']>
    'siop/imports/errors': ExtractProps<(typeof import('../../inertia/pages/siop/imports/errors.tsx'))['default']>
    'siop/imports/index': ExtractProps<(typeof import('../../inertia/pages/siop/imports/index.tsx'))['default']>
    'siop/imports/new': ExtractProps<(typeof import('../../inertia/pages/siop/imports/new.tsx'))['default']>
    'siop/imports/show': ExtractProps<(typeof import('../../inertia/pages/siop/imports/show.tsx'))['default']>
    'tenants/select': ExtractProps<(typeof import('../../inertia/pages/tenants/select.tsx'))['default']>
  }
}
