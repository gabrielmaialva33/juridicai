/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'drive.fs.serve': {
    methods: ["GET","HEAD"],
    pattern: '/uploads/*',
    tokens: [{"old":"/uploads/*","type":0,"val":"uploads","end":""},{"old":"/uploads/*","type":2,"val":"*","end":""}],
    types: placeholder as Registry['drive.fs.serve']['types'],
  },
  'healthz': {
    methods: ["GET","HEAD"],
    pattern: '/healthz',
    tokens: [{"old":"/healthz","type":0,"val":"healthz","end":""}],
    types: placeholder as Registry['healthz']['types'],
  },
  'client_errors.store': {
    methods: ["POST"],
    pattern: '/client-errors',
    tokens: [{"old":"/client-errors","type":0,"val":"client-errors","end":""}],
    types: placeholder as Registry['client_errors.store']['types'],
  },
  'auth.signup.create': {
    methods: ["GET","HEAD"],
    pattern: '/signup',
    tokens: [{"old":"/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['auth.signup.create']['types'],
  },
  'auth.signup.store': {
    methods: ["POST"],
    pattern: '/signup',
    tokens: [{"old":"/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['auth.signup.store']['types'],
  },
  'auth.login.create': {
    methods: ["GET","HEAD"],
    pattern: '/login',
    tokens: [{"old":"/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['auth.login.create']['types'],
  },
  'auth.login.store': {
    methods: ["POST"],
    pattern: '/login',
    tokens: [{"old":"/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['auth.login.store']['types'],
  },
  'auth.logout': {
    methods: ["POST"],
    pattern: '/logout',
    tokens: [{"old":"/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['auth.logout']['types'],
  },
  'tenants.select': {
    methods: ["GET","HEAD"],
    pattern: '/tenants/select',
    tokens: [{"old":"/tenants/select","type":0,"val":"tenants","end":""},{"old":"/tenants/select","type":0,"val":"select","end":""}],
    types: placeholder as Registry['tenants.select']['types'],
  },
  'tenants.select.store': {
    methods: ["POST"],
    pattern: '/tenants/select',
    tokens: [{"old":"/tenants/select","type":0,"val":"tenants","end":""},{"old":"/tenants/select","type":0,"val":"select","end":""}],
    types: placeholder as Registry['tenants.select.store']['types'],
  },
  'siop.imports.index': {
    methods: ["GET","HEAD"],
    pattern: '/siop/imports',
    tokens: [{"old":"/siop/imports","type":0,"val":"siop","end":""},{"old":"/siop/imports","type":0,"val":"imports","end":""}],
    types: placeholder as Registry['siop.imports.index']['types'],
  },
  'siop.imports.store': {
    methods: ["POST"],
    pattern: '/siop/imports',
    tokens: [{"old":"/siop/imports","type":0,"val":"siop","end":""},{"old":"/siop/imports","type":0,"val":"imports","end":""}],
    types: placeholder as Registry['siop.imports.store']['types'],
  },
  'siop.imports.show': {
    methods: ["GET","HEAD"],
    pattern: '/siop/imports/:id',
    tokens: [{"old":"/siop/imports/:id","type":0,"val":"siop","end":""},{"old":"/siop/imports/:id","type":0,"val":"imports","end":""},{"old":"/siop/imports/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['siop.imports.show']['types'],
  },
  'siop.imports.errors': {
    methods: ["GET","HEAD"],
    pattern: '/siop/imports/:id/errors',
    tokens: [{"old":"/siop/imports/:id/errors","type":0,"val":"siop","end":""},{"old":"/siop/imports/:id/errors","type":0,"val":"imports","end":""},{"old":"/siop/imports/:id/errors","type":1,"val":"id","end":""},{"old":"/siop/imports/:id/errors","type":0,"val":"errors","end":""}],
    types: placeholder as Registry['siop.imports.errors']['types'],
  },
  'siop.imports.reprocess': {
    methods: ["POST"],
    pattern: '/siop/imports/:id/reprocess',
    tokens: [{"old":"/siop/imports/:id/reprocess","type":0,"val":"siop","end":""},{"old":"/siop/imports/:id/reprocess","type":0,"val":"imports","end":""},{"old":"/siop/imports/:id/reprocess","type":1,"val":"id","end":""},{"old":"/siop/imports/:id/reprocess","type":0,"val":"reprocess","end":""}],
    types: placeholder as Registry['siop.imports.reprocess']['types'],
  },
  'siop.imports.download_source': {
    methods: ["GET","HEAD"],
    pattern: '/siop/imports/:id/download-source',
    tokens: [{"old":"/siop/imports/:id/download-source","type":0,"val":"siop","end":""},{"old":"/siop/imports/:id/download-source","type":0,"val":"imports","end":""},{"old":"/siop/imports/:id/download-source","type":1,"val":"id","end":""},{"old":"/siop/imports/:id/download-source","type":0,"val":"download-source","end":""}],
    types: placeholder as Registry['siop.imports.download_source']['types'],
  },
  'precatorios.index': {
    methods: ["GET","HEAD"],
    pattern: '/precatorios',
    tokens: [{"old":"/precatorios","type":0,"val":"precatorios","end":""}],
    types: placeholder as Registry['precatorios.index']['types'],
  },
  'precatorios.show': {
    methods: ["GET","HEAD"],
    pattern: '/precatorios/:id',
    tokens: [{"old":"/precatorios/:id","type":0,"val":"precatorios","end":""},{"old":"/precatorios/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['precatorios.show']['types'],
  },
  'debtors.index': {
    methods: ["GET","HEAD"],
    pattern: '/debtors',
    tokens: [{"old":"/debtors","type":0,"val":"debtors","end":""}],
    types: placeholder as Registry['debtors.index']['types'],
  },
  'debtors.show': {
    methods: ["GET","HEAD"],
    pattern: '/debtors/:id',
    tokens: [{"old":"/debtors/:id","type":0,"val":"debtors","end":""},{"old":"/debtors/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['debtors.show']['types'],
  },
  'pii.beneficiaries.reveal': {
    methods: ["POST"],
    pattern: '/pii/beneficiaries/:id/reveal',
    tokens: [{"old":"/pii/beneficiaries/:id/reveal","type":0,"val":"pii","end":""},{"old":"/pii/beneficiaries/:id/reveal","type":0,"val":"beneficiaries","end":""},{"old":"/pii/beneficiaries/:id/reveal","type":1,"val":"id","end":""},{"old":"/pii/beneficiaries/:id/reveal","type":0,"val":"reveal","end":""}],
    types: placeholder as Registry['pii.beneficiaries.reveal']['types'],
  },
  'exports.index': {
    methods: ["GET","HEAD"],
    pattern: '/exports',
    tokens: [{"old":"/exports","type":0,"val":"exports","end":""}],
    types: placeholder as Registry['exports.index']['types'],
  },
  'exports.store': {
    methods: ["POST"],
    pattern: '/exports',
    tokens: [{"old":"/exports","type":0,"val":"exports","end":""}],
    types: placeholder as Registry['exports.store']['types'],
  },
  'exports.show': {
    methods: ["GET","HEAD"],
    pattern: '/exports/:id',
    tokens: [{"old":"/exports/:id","type":0,"val":"exports","end":""},{"old":"/exports/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['exports.show']['types'],
  },
  'exports.download': {
    methods: ["GET","HEAD"],
    pattern: '/exports/:id/download',
    tokens: [{"old":"/exports/:id/download","type":0,"val":"exports","end":""},{"old":"/exports/:id/download","type":1,"val":"id","end":""},{"old":"/exports/:id/download","type":0,"val":"download","end":""}],
    types: placeholder as Registry['exports.download']['types'],
  },
  'dashboard.index': {
    methods: ["GET","HEAD"],
    pattern: '/dashboard',
    tokens: [{"old":"/dashboard","type":0,"val":"dashboard","end":""}],
    types: placeholder as Registry['dashboard.index']['types'],
  },
  'admin.health': {
    methods: ["GET","HEAD"],
    pattern: '/admin/health',
    tokens: [{"old":"/admin/health","type":0,"val":"admin","end":""},{"old":"/admin/health","type":0,"val":"health","end":""}],
    types: placeholder as Registry['admin.health']['types'],
  },
  'admin.jobs.index': {
    methods: ["GET","HEAD"],
    pattern: '/admin/jobs',
    tokens: [{"old":"/admin/jobs","type":0,"val":"admin","end":""},{"old":"/admin/jobs","type":0,"val":"jobs","end":""}],
    types: placeholder as Registry['admin.jobs.index']['types'],
  },
  'admin.jobs.retry': {
    methods: ["POST"],
    pattern: '/admin/jobs/:id/retry',
    tokens: [{"old":"/admin/jobs/:id/retry","type":0,"val":"admin","end":""},{"old":"/admin/jobs/:id/retry","type":0,"val":"jobs","end":""},{"old":"/admin/jobs/:id/retry","type":1,"val":"id","end":""},{"old":"/admin/jobs/:id/retry","type":0,"val":"retry","end":""}],
    types: placeholder as Registry['admin.jobs.retry']['types'],
  },
  'home': {
    methods: ["GET","HEAD"],
    pattern: '/',
    tokens: [{"old":"/","type":0,"val":"/","end":""}],
    types: placeholder as Registry['home']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
