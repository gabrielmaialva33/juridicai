import factory from '@adonisjs/lucid/factories'
import { FactoryContextContract } from '@adonisjs/lucid/types/factory'
import AuditLog from '#models/audit_log'

export const AuditLogFactory = factory
  .define(AuditLog, async ({ faker }: FactoryContextContract) => {
    const resources = ['users', 'tenants', 'files', 'clients', 'cases', 'documents', 'permissions']
    const actions = ['create', 'read', 'update', 'delete', 'list']
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    const results: ('granted' | 'denied')[] = ['granted', 'denied']

    return {
      resource: faker.helpers.arrayElement(resources),
      action: faker.helpers.arrayElement(actions),
      result: faker.helpers.arrayElement(results),
      user_id: null, // Will be set in relationships
      session_id: faker.string.uuid(),
      ip_address: faker.internet.ip(),
      user_agent: faker.internet.userAgent(),
      context: faker.helpers.arrayElement(['own', 'team', 'department', null]),
      resource_id: faker.number.int({ min: 1, max: 1000 }),
      method: faker.helpers.arrayElement(methods),
      url: `/${faker.helpers.arrayElement(resources)}/${faker.number.int({ min: 1, max: 100 })}`,
      request_data: null,
      reason: null,
      response_code: faker.helpers.arrayElement([200, 201, 204, 400, 401, 403, 404, 500]),
      metadata: null,
    }
  })
  .state('granted', (auditLog, { faker }) => {
    auditLog.result = 'granted'
    auditLog.response_code = faker.helpers.arrayElement([200, 201, 204])
  })
  .state('denied', (auditLog, { faker }) => {
    auditLog.result = 'denied'
    auditLog.response_code = faker.helpers.arrayElement([401, 403, 404])
    auditLog.reason = faker.helpers.arrayElement([
      'Insufficient permissions',
      'Resource not found',
      'Invalid credentials',
      'Expired token',
    ])
  })
  .state('permission_check', (auditLog, { faker }) => {
    auditLog.action = faker.helpers.arrayElement(['read', 'update', 'delete'])
    auditLog.resource = faker.helpers.arrayElement(['users', 'tenants', 'files'])
  })
  .state('security_alert', (auditLog, { faker }) => {
    auditLog.result = 'denied'
    auditLog.action = 'authenticate'
    auditLog.resource = 'sessions'
    auditLog.reason = faker.helpers.arrayElement([
      'Invalid credentials',
      'Account locked',
      'Too many attempts',
    ])
  })
  .build()
