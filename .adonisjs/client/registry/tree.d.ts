/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  drive: {
    fs: {
      serve: typeof routes['drive.fs.serve']
    }
  }
  healthz: typeof routes['healthz']
  clientErrors: {
    store: typeof routes['client_errors.store']
  }
  auth: {
    signup: {
      create: typeof routes['auth.signup.create']
      store: typeof routes['auth.signup.store']
    }
    login: {
      create: typeof routes['auth.login.create']
      store: typeof routes['auth.login.store']
    }
    logout: typeof routes['auth.logout']
  }
  tenants: {
    select: typeof routes['tenants.select'] & {
      store: typeof routes['tenants.select.store']
    }
  }
  siop: {
    imports: {
      index: typeof routes['siop.imports.index']
      store: typeof routes['siop.imports.store']
      show: typeof routes['siop.imports.show']
      errors: typeof routes['siop.imports.errors']
      reprocess: typeof routes['siop.imports.reprocess']
      downloadSource: typeof routes['siop.imports.download_source']
    }
  }
  precatorios: {
    index: typeof routes['precatorios.index']
    show: typeof routes['precatorios.show']
  }
  debtors: {
    index: typeof routes['debtors.index']
    show: typeof routes['debtors.show']
  }
  pii: {
    beneficiaries: {
      reveal: typeof routes['pii.beneficiaries.reveal']
    }
  }
  exports: {
    index: typeof routes['exports.index']
    store: typeof routes['exports.store']
    show: typeof routes['exports.show']
    download: typeof routes['exports.download']
  }
  dashboard: {
    index: typeof routes['dashboard.index']
  }
  admin: {
    health: typeof routes['admin.health']
    jobs: {
      index: typeof routes['admin.jobs.index']
      retry: typeof routes['admin.jobs.retry']
    }
  }
  home: typeof routes['home']
}
