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
  'auth.profile': {
    methods: ["GET","HEAD"]
    pattern: '/profile'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/auth/controllers/profile_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/auth/controllers/profile_controller').default['show']>>>
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
  'settings.tenant': {
    methods: ["GET","HEAD"]
    pattern: '/settings/tenant'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/tenant/controllers/settings_controller').default['tenant']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/tenant/controllers/settings_controller').default['tenant']>>>
    }
  }
  'settings.users': {
    methods: ["GET","HEAD"]
    pattern: '/settings/users'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/tenant/controllers/settings_controller').default['users']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/tenant/controllers/settings_controller').default['users']>>>
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
  'siop.imports.new': {
    methods: ["GET","HEAD"]
    pattern: '/siop/imports/new'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/siop/controllers/import_controller').default['newForm']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/siop/controllers/import_controller').default['newForm']>>>
    }
  }
  'siop.imports.sources': {
    methods: ["GET","HEAD"]
    pattern: '/siop/imports/sources'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/siop/controllers/import_controller').default['sources']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/siop/controllers/import_controller').default['sources']>>>
    }
  }
  'siop.imports.jobs.status': {
    methods: ["GET","HEAD"]
    pattern: '/siop/imports/jobs/:id/status'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/siop/controllers/import_controller').default['jobStatus']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/siop/controllers/import_controller').default['jobStatus']>>>
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
  'siop.imports.trf6_export.store': {
    methods: ["POST"]
    pattern: '/siop/imports/trf6-export'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/siop/validators/upload_validator').uploadValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/siop/validators/upload_validator').uploadValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/siop/controllers/import_controller').default['storeTrf6Export']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/siop/controllers/import_controller').default['storeTrf6Export']>>> | { status: 422; response: { errors: SimpleError[] } }
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
  'precatorios.timeline': {
    methods: ["GET","HEAD"]
    pattern: '/precatorios/:id/timeline'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/precatorios/controllers/precatorios_controller').default['timeline']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/precatorios/controllers/precatorios_controller').default['timeline']>>>
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
  'integrations.government.coverage.index': {
    methods: ["GET","HEAD"]
    pattern: '/admin/integrations/coverage'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/integrations/controllers/government_coverage_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/integrations/controllers/government_coverage_controller').default['index']>>>
    }
  }
  'integrations.government.data_coherence.index': {
    methods: ["GET","HEAD"]
    pattern: '/admin/integrations/data-coherence'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/integrations/controllers/national_data_coherence_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/integrations/controllers/national_data_coherence_controller').default['index']>>>
    }
  }
  'integrations.tribunal.budget_executions.index': {
    methods: ["GET","HEAD"]
    pattern: '/admin/tribunal/budget-executions'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/integrations/controllers/tribunal_budget_executions_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/integrations/controllers/tribunal_budget_executions_controller').default['index']>>>
    }
  }
  'integrations.datajud.candidates.index': {
    methods: ["GET","HEAD"]
    pattern: '/admin/datajud/candidates'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/integrations/controllers/datajud_candidates_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/integrations/controllers/datajud_candidates_controller').default['index']>>>
    }
  }
  'integrations.datajud.candidates.show': {
    methods: ["GET","HEAD"]
    pattern: '/admin/datajud/candidates/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/integrations/controllers/datajud_candidates_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/integrations/controllers/datajud_candidates_controller').default['show']>>>
    }
  }
  'integrations.datajud.candidates.accept': {
    methods: ["POST"]
    pattern: '/admin/datajud/candidates/:id/accept'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/integrations/controllers/datajud_candidates_controller').default['accept']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/integrations/controllers/datajud_candidates_controller').default['accept']>>>
    }
  }
  'integrations.datajud.candidates.reject': {
    methods: ["POST"]
    pattern: '/admin/datajud/candidates/:id/reject'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/integrations/controllers/datajud_candidates_controller').default['reject']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/integrations/controllers/datajud_candidates_controller').default['reject']>>>
    }
  }
  'integrations.datajud.candidates.ambiguous': {
    methods: ["POST"]
    pattern: '/admin/datajud/candidates/:id/ambiguous'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/integrations/controllers/datajud_candidates_controller').default['markAmbiguous']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/integrations/controllers/datajud_candidates_controller').default['markAmbiguous']>>>
    }
  }
  'operations.desk': {
    methods: ["GET","HEAD"]
    pattern: '/operations/desk'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/operations/controllers/operations_controller').default['desk']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/operations/controllers/operations_controller').default['desk']>>>
    }
  }
  'operations.opportunities.index': {
    methods: ["GET","HEAD"]
    pattern: '/operations/opportunities'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/operations/controllers/operations_controller').default['opportunities']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/operations/controllers/operations_controller').default['opportunities']>>>
    }
  }
  'operations.opportunities.bulk_pipeline': {
    methods: ["POST"]
    pattern: '/operations/opportunities/bulk-pipeline'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/operations/controllers/operations_controller').default['bulkMoveToPipeline']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/operations/controllers/operations_controller').default['bulkMoveToPipeline']>>>
    }
  }
  'operations.opportunities.show': {
    methods: ["GET","HEAD"]
    pattern: '/operations/opportunities/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/operations/controllers/operations_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/operations/controllers/operations_controller').default['show']>>>
    }
  }
  'operations.opportunities.liquidity': {
    methods: ["GET","HEAD"]
    pattern: '/operations/opportunities/:id/liquidity'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/operations/controllers/operations_controller').default['liquidity']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/operations/controllers/operations_controller').default['liquidity']>>>
    }
  }
  'operations.opportunities.dossier': {
    methods: ["GET","HEAD"]
    pattern: '/operations/opportunities/:id/dossier'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/operations/controllers/operations_controller').default['dossier']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/operations/controllers/operations_controller').default['dossier']>>>
    }
  }
  'operations.opportunities.intelligence_actions': {
    methods: ["POST"]
    pattern: '/operations/opportunities/:id/intelligence/actions'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/operations/controllers/operations_controller').default['runIntelligenceActions']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/operations/controllers/operations_controller').default['runIntelligenceActions']>>>
    }
  }
  'operations.opportunities.pricing': {
    methods: ["POST"]
    pattern: '/operations/opportunities/:id/pricing'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/operations/controllers/operations_controller').default['pricing']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/operations/controllers/operations_controller').default['pricing']>>>
    }
  }
  'operations.opportunities.pipeline': {
    methods: ["POST"]
    pattern: '/operations/opportunities/:id/pipeline'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/operations/controllers/operations_controller').default['moveToPipeline']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/operations/controllers/operations_controller').default['moveToPipeline']>>>
    }
  }
  'operations.pipeline': {
    methods: ["GET","HEAD"]
    pattern: '/operations/pipeline'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/operations/controllers/operations_controller').default['pipeline']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/operations/controllers/operations_controller').default['pipeline']>>>
    }
  }
  'legal_publications.index': {
    methods: ["GET","HEAD"]
    pattern: '/legal-publications'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publications_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publications_controller').default['index']>>>
    }
  }
  'legal_publications.monitoring': {
    methods: ["GET","HEAD"]
    pattern: '/legal-publications/monitoring'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publication_monitoring_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publication_monitoring_controller').default['index']>>>
    }
  }
  'legal_publications.monitoring.cases.store': {
    methods: ["POST"]
    pattern: '/legal-publications/monitoring/cases'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/legal_publications/validators/legal_publication_monitoring_validator').monitoredCaseValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/legal_publications/validators/legal_publication_monitoring_validator').monitoredCaseValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publication_monitoring_controller').default['storeCase']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publication_monitoring_controller').default['storeCase']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'legal_publications.monitoring.cases.update': {
    methods: ["POST"]
    pattern: '/legal-publications/monitoring/cases/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/legal_publications/validators/legal_publication_monitoring_validator').monitoredCaseValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/legal_publications/validators/legal_publication_monitoring_validator').monitoredCaseValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publication_monitoring_controller').default['updateCase']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publication_monitoring_controller').default['updateCase']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'legal_publications.monitoring.cases.active': {
    methods: ["POST"]
    pattern: '/legal-publications/monitoring/cases/:id/active'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/legal_publications/validators/legal_publication_monitoring_validator').monitoringActiveToggleValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/legal_publications/validators/legal_publication_monitoring_validator').monitoringActiveToggleValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publication_monitoring_controller').default['toggleCase']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publication_monitoring_controller').default['toggleCase']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'legal_publications.monitoring.bar_registrations.store': {
    methods: ["POST"]
    pattern: '/legal-publications/monitoring/bar-registrations'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/legal_publications/validators/legal_publication_monitoring_validator').monitoredBarRegistrationValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#modules/legal_publications/validators/legal_publication_monitoring_validator').monitoredBarRegistrationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publication_monitoring_controller').default['storeBarRegistration']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publication_monitoring_controller').default['storeBarRegistration']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'legal_publications.monitoring.bar_registrations.update': {
    methods: ["POST"]
    pattern: '/legal-publications/monitoring/bar-registrations/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/legal_publications/validators/legal_publication_monitoring_validator').monitoredBarRegistrationValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/legal_publications/validators/legal_publication_monitoring_validator').monitoredBarRegistrationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publication_monitoring_controller').default['updateBarRegistration']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publication_monitoring_controller').default['updateBarRegistration']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'legal_publications.monitoring.bar_registrations.active': {
    methods: ["POST"]
    pattern: '/legal-publications/monitoring/bar-registrations/:id/active'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/legal_publications/validators/legal_publication_monitoring_validator').monitoringActiveToggleValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/legal_publications/validators/legal_publication_monitoring_validator').monitoringActiveToggleValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publication_monitoring_controller').default['toggleBarRegistration']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publication_monitoring_controller').default['toggleBarRegistration']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'legal_publications.confirm': {
    methods: ["POST"]
    pattern: '/legal-publications/:id/confirm'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publications_controller').default['confirm']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publications_controller').default['confirm']>>>
    }
  }
  'legal_publications.dismiss': {
    methods: ["POST"]
    pattern: '/legal-publications/:id/dismiss'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publications_controller').default['dismiss']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publications_controller').default['dismiss']>>>
    }
  }
  'legal_publications.deadline.update': {
    methods: ["POST"]
    pattern: '/legal-publications/:id/deadline'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/legal_publications/validators/legal_publication_actions_validator').legalPublicationManualDeadlineValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/legal_publications/validators/legal_publication_actions_validator').legalPublicationManualDeadlineValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publications_controller').default['updateDeadline']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publications_controller').default['updateDeadline']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'legal_publications.interpretation.update': {
    methods: ["POST"]
    pattern: '/legal-publications/:id/interpretation'
    types: {
      body: ExtractBody<InferInput<(typeof import('#modules/legal_publications/validators/legal_publication_actions_validator').legalPublicationInterpretationEditValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#modules/legal_publications/validators/legal_publication_actions_validator').legalPublicationInterpretationEditValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publications_controller').default['updateInterpretation']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/legal_publications/controllers/legal_publications_controller').default['updateInterpretation']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'market.rates.snapshot': {
    methods: ["GET","HEAD"]
    pattern: '/market/rates/snapshot'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/market/controllers/market_rates_controller').default['snapshot']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/market/controllers/market_rates_controller').default['snapshot']>>>
    }
  }
  'market.rates.sync_bcb': {
    methods: ["POST"]
    pattern: '/market/rates/sync-bcb'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#modules/market/controllers/market_rates_controller').default['syncBcb']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#modules/market/controllers/market_rates_controller').default['syncBcb']>>>
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
