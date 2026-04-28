import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'healthz': { paramsTuple?: []; params?: {} }
    'auth.signup.create': { paramsTuple?: []; params?: {} }
    'auth.signup.store': { paramsTuple?: []; params?: {} }
    'auth.login.create': { paramsTuple?: []; params?: {} }
    'auth.login.store': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'tenants.select': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'healthz': { paramsTuple?: []; params?: {} }
    'auth.signup.create': { paramsTuple?: []; params?: {} }
    'auth.login.create': { paramsTuple?: []; params?: {} }
    'tenants.select': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'healthz': { paramsTuple?: []; params?: {} }
    'auth.signup.create': { paramsTuple?: []; params?: {} }
    'auth.login.create': { paramsTuple?: []; params?: {} }
    'tenants.select': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'auth.signup.store': { paramsTuple?: []; params?: {} }
    'auth.login.store': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}
