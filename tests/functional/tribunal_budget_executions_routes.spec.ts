import { test } from '@japa/runner'
import Permission from '#modules/permission/models/permission'
import RolePermission from '#modules/permission/models/role_permission'
import TribunalBudgetExecution from '#modules/integrations/models/tribunal_budget_execution'
import { RoleFactory } from '#database/factories/role_factory'
import { SourceRecordFactory } from '#database/factories/source_record_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import { TenantMembershipFactory } from '#database/factories/tenant_membership_factory'
import { UserFactory } from '#database/factories/user_factory'
import { UserRoleFactory } from '#database/factories/user_role_factory'
import type User from '#modules/auth/models/user'
import type Role from '#modules/permission/models/role'
import type Tenant from '#modules/tenant/models/tenant'
import type TenantMembership from '#modules/tenant/models/tenant_membership'
import type UserRole from '#modules/permission/models/user_role'
import type { PermissionSlug } from '#modules/permission/seeders_data'

const BASE_URL = 'http://localhost:3333'

test.group('Tribunal budget execution routes', () => {
  test('requires authentication', async ({ assert }) => {
    const response = await apiFetch('/admin/tribunal/budget-executions')

    assert.equal(response.status, 401)
  })

  test('lists tenant-scoped budget execution rows with aggregate totals', async ({ assert }) => {
    const fixture = await createAccessFixture(['imports.read'])
    const otherTenant = await TenantFactory.create()
    const sourceRecord = await SourceRecordFactory.merge({
      tenantId: fixture.tenant.id,
      source: 'tribunal',
      sourceChecksum: `tribunal-budget-execution-route-${fixture.tenant.id}`,
    }).create()
    const otherSourceRecord = await SourceRecordFactory.merge({
      tenantId: otherTenant.id,
      source: 'tribunal',
      sourceChecksum: `tribunal-budget-execution-route-${otherTenant.id}`,
    }).create()
    const execution = await TribunalBudgetExecution.create({
      tenantId: fixture.tenant.id,
      sourceRecordId: sourceRecord.id,
      courtAlias: 'trf3',
      sourceKind: 'cnj_102_monthly_report',
      referenceYear: 2026,
      referenceMonth: 1,
      budgetUnitCode: '33904',
      budgetUnitName: 'FUNDO DO REGIME GERAL DA PREVIDENCIA SOCIAL',
      programName: 'OPERACOES ESPECIAIS: CUMPRIMENTO DE SENTENCAS JUDICIAIS',
      actionName: 'SENTENCAS JUDICIAIS TRANSITADAS EM JULGADO DE PEQUENO VALOR',
      netAllocation: '51152493.00',
      committedAmount: '51070572.00',
      liquidatedAmount: '51070572.00',
      paidAmount: '51070572.00',
      rowFingerprint: `route-test-${fixture.tenant.id}`,
    })
    await TribunalBudgetExecution.create({
      tenantId: otherTenant.id,
      sourceRecordId: otherSourceRecord.id,
      courtAlias: 'trf3',
      sourceKind: 'cnj_102_monthly_report',
      referenceYear: 2026,
      referenceMonth: 1,
      budgetUnitCode: '71103',
      budgetUnitName: 'ENCARGOS FINANC.DA UNIAO-SENTENCAS JUDICIAIS',
      netAllocation: '217229.00',
      committedAmount: '217228.00',
      liquidatedAmount: '217228.00',
      paidAmount: '217228.00',
      rowFingerprint: `route-test-${otherTenant.id}`,
    })
    const sessionCookie = await loginAndGetSessionCookie(fixture.user)

    const response = await apiFetch(
      '/admin/tribunal/budget-executions?courtAlias=trf3&referenceYear=2026&referenceMonth=1&q=previdencia',
      {
        sessionCookie,
        tenant: fixture.tenant,
      }
    )
    const executions = response.body.executions as Array<{ id: string; budgetUnitCode: string }>

    assert.equal(response.status, 200)
    assert.deepEqual(
      executions.map((row) => ({ id: row.id, budgetUnitCode: row.budgetUnitCode })),
      [{ id: execution.id, budgetUnitCode: '33904' }]
    )
    assert.deepEqual(response.body.summary, {
      rowsCount: 1,
      netAllocationTotal: '51152493.00',
      committedAmountTotal: '51070572.00',
      liquidatedAmountTotal: '51070572.00',
      paidAmountTotal: '51070572.00',
    })

    await fixture.cleanup()
    await otherSourceRecord.delete()
    await otherTenant.delete()
  })
})

async function createAccessFixture(permissions: PermissionSlug[]) {
  const createdPermissions: Permission[] = []
  const rolePermissions: RolePermission[] = []
  const tenant = await TenantFactory.create()
  const user = await UserFactory.create()
  const role = await RoleFactory.create()
  const membership = await TenantMembershipFactory.merge({
    tenantId: tenant.id,
    userId: user.id,
  }).create()
  const userRole = await UserRoleFactory.merge({
    tenantId: tenant.id,
    userId: user.id,
    roleId: role.id,
  }).create()

  for (const slug of permissions) {
    const existingPermission = await Permission.query().where('slug', slug).first()
    const permission =
      existingPermission ??
      (await Permission.create({
        slug,
        name: slug,
        description: 'Generated by tribunal budget execution route tests.',
      }))

    if (!existingPermission) {
      createdPermissions.push(permission)
    }

    rolePermissions.push(
      await RolePermission.create({
        roleId: role.id,
        permissionId: permission.id,
      })
    )
  }

  return {
    tenant,
    user,
    role,
    async cleanup() {
      await cleanupAccessFixture({
        tenant,
        user,
        role,
        rolePermissions,
        createdPermissions,
        membership,
        userRole,
      })
    },
  }
}

async function cleanupAccessFixture(input: {
  tenant: Tenant
  user: User
  role: Role
  rolePermissions: RolePermission[]
  createdPermissions: Permission[]
  membership: TenantMembership
  userRole: UserRole
}) {
  for (const rolePermission of input.rolePermissions) {
    await rolePermission.delete()
  }

  await input.userRole.delete()
  await input.membership.delete()
  await input.role.delete()
  await input.tenant.delete()
  await input.user.delete()

  for (const permission of input.createdPermissions) {
    await permission.delete()
  }
}

async function loginAndGetSessionCookie(user: User) {
  const loginPage = await fetch(url('/login'), {
    headers: { accept: 'text/html' },
    redirect: 'manual',
  })
  const initialSessionCookie = getCookie(loginPage.headers, 'adonis-session')
  const initialCsrfToken = getCookie(loginPage.headers, 'XSRF-TOKEN')

  if (!initialSessionCookie || !initialCsrfToken) {
    throw new Error('Login page did not issue the expected session and XSRF cookies.')
  }

  const loginResponse = await fetch(url('/login'), {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'cookie': `adonis-session=${initialSessionCookie}`,
      'x-xsrf-token': xsrfTokenHeader(initialCsrfToken),
    },
    body: JSON.stringify({
      email: user.email,
      password: 'secret123',
    }),
  })

  if (![200, 204, 302, 303].includes(loginResponse.status)) {
    throw new Error(`Login request failed with status ${loginResponse.status}.`)
  }

  return getCookie(loginResponse.headers, 'adonis-session') ?? initialSessionCookie
}

async function apiFetch(
  path: string,
  options: {
    sessionCookie?: string
    tenant?: Tenant
  } = {}
) {
  const headers: Record<string, string> = {
    accept: 'application/json',
  }

  if (options.sessionCookie) {
    headers.cookie = `adonis-session=${options.sessionCookie}`
  }

  if (options.tenant) {
    headers['x-tenant-id'] = options.tenant.id
  }

  const response = await fetch(url(path), { headers })
  const text = await response.text()

  return {
    status: response.status,
    body: text ? JSON.parse(text) : {},
  }
}

function xsrfTokenHeader(cookieValue: string) {
  return decodeURIComponent(cookieValue)
}

function getCookie(headers: Headers, name: string) {
  const cookies = getSetCookieValues(headers)
  let cookieValue: string | undefined

  for (const cookie of cookies) {
    const match = new RegExp(`(?:^|,\\s*)${name}=([^;]+)`).exec(cookie)

    if (match) {
      cookieValue = match[1]
    }
  }

  return cookieValue
}

function getSetCookieValues(headers: Headers) {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie

  if (getSetCookie) {
    return getSetCookie.call(headers)
  }

  const header = headers.get('set-cookie')

  return header ? [header] : []
}

function url(path: string) {
  return `${BASE_URL}${path}`
}
