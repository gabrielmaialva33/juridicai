import { AsyncLocalStorage } from 'node:async_hooks'

interface TenantContextState {
  tenantId: string
  requestId?: string
  userId?: string
}

class TenantContext {
  #storage = new AsyncLocalStorage<TenantContextState>()

  run<T>(state: TenantContextState, callback: () => T): T {
    return this.#storage.run(state, callback)
  }

  get(): TenantContextState | undefined {
    return this.#storage.getStore()
  }

  getTenantId(): string | undefined {
    return this.get()?.tenantId
  }

  requireTenantId(): string {
    const tenantId = this.getTenantId()

    if (!tenantId) {
      throw new Error('Tenant context is not available')
    }

    return tenantId
  }
}

export default new TenantContext()
