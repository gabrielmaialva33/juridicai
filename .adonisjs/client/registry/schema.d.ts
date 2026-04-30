/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'drive.fs.serve': {
    methods: ["GET","HEAD"]
    pattern: '/uploads/*'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { '*': ParamValue[] }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'healthz': {
    methods: ["GET","HEAD"]
    pattern: '/healthz'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/healthcheck/controllers/healthz_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/healthcheck/controllers/healthz_controller').default['show']>>>
    }
  }
  'client_errors.store': {
    methods: ["POST"]
    pattern: '/client-errors'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/client_errors/controllers/client_errors_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/client_errors/controllers/client_errors_controller').default['store']>>>
    }
  }
  'auth.signup.create': {
    methods: ["GET","HEAD"]
    pattern: '/signup'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/auth/controllers/signup_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/auth/controllers/signup_controller').default['create']>>>
    }
  }
  'auth.signup.store': {
    methods: ["POST"]
    pattern: '/signup'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/auth/validators/signup_validator').signupValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/auth/validators/signup_validator').signupValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/auth/controllers/signup_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/auth/controllers/signup_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.login.create': {
    methods: ["GET","HEAD"]
    pattern: '/login'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/auth/controllers/login_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/auth/controllers/login_controller').default['create']>>>
    }
  }
  'auth.login.store': {
    methods: ["POST"]
    pattern: '/login'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/auth/validators/login_validator').loginValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/auth/validators/login_validator').loginValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/auth/controllers/login_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/auth/controllers/login_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.logout': {
    methods: ["POST"]
    pattern: '/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/auth/controllers/login_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/auth/controllers/login_controller').default['destroy']>>>
    }
  }
  'tenants.select': {
    methods: ["GET","HEAD"]
    pattern: '/tenants/select'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/tenant/controllers/tenant_select_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/tenant/controllers/tenant_select_controller').default['index']>>>
    }
  }
  'tenants.select.store': {
    methods: ["POST"]
    pattern: '/tenants/select'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/tenant/controllers/tenant_select_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/tenant/controllers/tenant_select_controller').default['store']>>>
    }
  }
  'siop.imports.index': {
    methods: ["GET","HEAD"]
    pattern: '/siop/imports'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/siop/controllers/import_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/siop/controllers/import_controller').default['index']>>>
    }
  }
  'siop.imports.store': {
    methods: ["POST"]
    pattern: '/siop/imports'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/siop/validators/upload_validator').uploadValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/siop/validators/upload_validator').uploadValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/siop/controllers/import_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/siop/controllers/import_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'siop.imports.show': {
    methods: ["GET","HEAD"]
    pattern: '/siop/imports/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/siop/controllers/import_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/siop/controllers/import_controller').default['show']>>>
    }
  }
  'siop.imports.errors': {
    methods: ["GET","HEAD"]
    pattern: '/siop/imports/:id/errors'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/siop/controllers/import_controller').default['errors']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/siop/controllers/import_controller').default['errors']>>>
    }
  }
  'siop.imports.reprocess': {
    methods: ["POST"]
    pattern: '/siop/imports/:id/reprocess'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/siop/controllers/import_controller').default['reprocess']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/siop/controllers/import_controller').default['reprocess']>>>
    }
  }
  'siop.imports.download_source': {
    methods: ["GET","HEAD"]
    pattern: '/siop/imports/:id/download-source'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/siop/controllers/import_controller').default['downloadSource']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/siop/controllers/import_controller').default['downloadSource']>>>
    }
  }
  'precatorios.index': {
    methods: ["GET","HEAD"]
    pattern: '/precatorios'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/precatorios/controllers/precatorios_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/precatorios/controllers/precatorios_controller').default['index']>>>
    }
  }
  'precatorios.show': {
    methods: ["GET","HEAD"]
    pattern: '/precatorios/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/precatorios/controllers/precatorios_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/precatorios/controllers/precatorios_controller').default['show']>>>
    }
  }
  'debtors.index': {
    methods: ["GET","HEAD"]
    pattern: '/debtors'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/debtors/controllers/debtors_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/debtors/controllers/debtors_controller').default['index']>>>
    }
  }
  'debtors.show': {
    methods: ["GET","HEAD"]
    pattern: '/debtors/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/debtors/controllers/debtors_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/debtors/controllers/debtors_controller').default['show']>>>
    }
  }
  'pii.beneficiaries.reveal': {
    methods: ["POST"]
    pattern: '/pii/beneficiaries/:id/reveal'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/pii/controllers/reveal_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/pii/controllers/reveal_controller').default['show']>>>
    }
  }
  'exports.index': {
    methods: ["GET","HEAD"]
    pattern: '/exports'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/exports/controllers/exports_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/exports/controllers/exports_controller').default['index']>>>
    }
  }
  'exports.store': {
    methods: ["POST"]
    pattern: '/exports'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/exports/controllers/exports_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/exports/controllers/exports_controller').default['store']>>>
    }
  }
  'exports.show': {
    methods: ["GET","HEAD"]
    pattern: '/exports/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/exports/controllers/exports_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/exports/controllers/exports_controller').default['show']>>>
    }
  }
  'exports.download': {
    methods: ["GET","HEAD"]
    pattern: '/exports/:id/download'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/exports/controllers/exports_controller').default['download']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/exports/controllers/exports_controller').default['download']>>>
    }
  }
  'dashboard.index': {
    methods: ["GET","HEAD"]
    pattern: '/dashboard'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/dashboard/controllers/dashboard_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/dashboard/controllers/dashboard_controller').default['index']>>>
    }
  }
  'admin.health': {
    methods: ["GET","HEAD"]
    pattern: '/admin/health'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/admin/controllers/health_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/admin/controllers/health_controller').default['index']>>>
    }
  }
  'admin.jobs.index': {
    methods: ["GET","HEAD"]
    pattern: '/admin/jobs'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/admin/controllers/jobs_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/admin/controllers/jobs_controller').default['index']>>>
    }
  }
  'admin.jobs.retry': {
    methods: ["POST"]
    pattern: '/admin/jobs/:id/retry'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/admin/controllers/jobs_controller').default['retry']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/admin/controllers/jobs_controller').default['retry']>>>
    }
  }
  'home': {
    methods: ["GET","HEAD"]
    pattern: '/'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
}
