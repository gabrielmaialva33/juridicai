/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  drive: {
    fs: {
      serve: typeof routes['drive.fs.serve']
    }
  }
  healthz: typeof routes['healthz']
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
    select: typeof routes['tenants.select']
  }
  home: typeof routes['home']
}
