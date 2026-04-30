import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'healthz': { paramsTuple?: []; params?: {} }
    'client_errors.store': { paramsTuple?: []; params?: {} }
    'auth.signup.create': { paramsTuple?: []; params?: {} }
    'auth.signup.store': { paramsTuple?: []; params?: {} }
    'auth.login.create': { paramsTuple?: []; params?: {} }
    'auth.login.store': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'tenants.select': { paramsTuple?: []; params?: {} }
    'tenants.select.store': { paramsTuple?: []; params?: {} }
    'siop.imports.index': { paramsTuple?: []; params?: {} }
    'siop.imports.store': { paramsTuple?: []; params?: {} }
    'siop.imports.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'siop.imports.errors': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'siop.imports.reprocess': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'siop.imports.download_source': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'precatorios.index': { paramsTuple?: []; params?: {} }
    'precatorios.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'debtors.index': { paramsTuple?: []; params?: {} }
    'debtors.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pii.beneficiaries.reveal': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'exports.index': { paramsTuple?: []; params?: {} }
    'exports.store': { paramsTuple?: []; params?: {} }
    'exports.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'exports.download': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'dashboard.index': { paramsTuple?: []; params?: {} }
    'admin.health': { paramsTuple?: []; params?: {} }
    'admin.jobs.index': { paramsTuple?: []; params?: {} }
    'admin.jobs.retry': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'home': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'healthz': { paramsTuple?: []; params?: {} }
    'auth.signup.create': { paramsTuple?: []; params?: {} }
    'auth.login.create': { paramsTuple?: []; params?: {} }
    'tenants.select': { paramsTuple?: []; params?: {} }
    'siop.imports.index': { paramsTuple?: []; params?: {} }
    'siop.imports.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'siop.imports.errors': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'siop.imports.download_source': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'precatorios.index': { paramsTuple?: []; params?: {} }
    'precatorios.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'debtors.index': { paramsTuple?: []; params?: {} }
    'debtors.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'exports.index': { paramsTuple?: []; params?: {} }
    'exports.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'exports.download': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'dashboard.index': { paramsTuple?: []; params?: {} }
    'admin.health': { paramsTuple?: []; params?: {} }
    'admin.jobs.index': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'healthz': { paramsTuple?: []; params?: {} }
    'auth.signup.create': { paramsTuple?: []; params?: {} }
    'auth.login.create': { paramsTuple?: []; params?: {} }
    'tenants.select': { paramsTuple?: []; params?: {} }
    'siop.imports.index': { paramsTuple?: []; params?: {} }
    'siop.imports.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'siop.imports.errors': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'siop.imports.download_source': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'precatorios.index': { paramsTuple?: []; params?: {} }
    'precatorios.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'debtors.index': { paramsTuple?: []; params?: {} }
    'debtors.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'exports.index': { paramsTuple?: []; params?: {} }
    'exports.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'exports.download': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'dashboard.index': { paramsTuple?: []; params?: {} }
    'admin.health': { paramsTuple?: []; params?: {} }
    'admin.jobs.index': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'client_errors.store': { paramsTuple?: []; params?: {} }
    'auth.signup.store': { paramsTuple?: []; params?: {} }
    'auth.login.store': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'tenants.select.store': { paramsTuple?: []; params?: {} }
    'siop.imports.store': { paramsTuple?: []; params?: {} }
    'siop.imports.reprocess': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pii.beneficiaries.reveal': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'exports.store': { paramsTuple?: []; params?: {} }
    'admin.jobs.retry': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}