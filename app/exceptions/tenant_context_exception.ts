import BaseException from '#exceptions/base_exception'

/**
 * Exception for tenant context related errors
 */
export default class TenantContextException extends BaseException {
  static status = 403

  /**
   * Thrown when trying to create a model without tenant context
   */
  static missingForCreate(_modelName: string): TenantContextException {
    return new TenantContextException('No tenant ID in current context', {
      status: 403,
      code: 'E_MISSING_TENANT_CONTEXT',
    })
  }

  /**
   * Thrown when trying to query without tenant context in strict mode
   */
  static missingForQuery(modelName: string): TenantContextException {
    return new TenantContextException(
      `Cannot query ${modelName} without tenant context. Use .crossTenant() or .withoutTenantScope() to explicitly allow cross-tenant queries.`,
      { status: 403, code: 'E_MISSING_TENANT_CONTEXT' }
    )
  }

  /**
   * Thrown when trying to update a model from a different tenant
   */
  static crossTenantUpdate(
    modelName: string,
    currentTenant: string,
    modelTenant: string
  ): TenantContextException {
    return new TenantContextException(
      `Cannot update ${modelName} from different tenant. Current tenant: ${currentTenant}, Model tenant: ${modelTenant}`,
      { status: 403, code: 'E_CROSS_TENANT_UPDATE' }
    )
  }

  /**
   * Thrown when trying to delete a model from a different tenant
   */
  static crossTenantDelete(
    modelName: string,
    currentTenant: string,
    modelTenant: string
  ): TenantContextException {
    return new TenantContextException(
      `Cannot delete ${modelName} from different tenant. Current tenant: ${currentTenant}, Model tenant: ${modelTenant}`,
      { status: 403, code: 'E_CROSS_TENANT_DELETE' }
    )
  }

  /**
   * Thrown when model instance is missing tenant context
   */
  static missingOnInstance(modelName: string): TenantContextException {
    return new TenantContextException(`${modelName} instance is missing tenant context`, {
      status: 403,
      code: 'E_MISSING_TENANT_ON_INSTANCE',
    })
  }

  /**
   * Thrown when no tenant context is available for current operation
   */
  static noContextAvailable(): TenantContextException {
    return new TenantContextException('No tenant context available', {
      status: 403,
      code: 'E_NO_TENANT_CONTEXT',
    })
  }
}
