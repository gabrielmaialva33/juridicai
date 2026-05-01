import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Permission from '#modules/permission/models/permission'
import RolePermission from '#modules/permission/models/role_permission'
import AssetEvent from '#modules/precatorios/models/asset_event'
import { ProcessMatchCandidateFactory } from '#database/factories/process_match_candidate_factory'
import { PrecatorioAssetFactory } from '#database/factories/precatorio_asset_factory'
import { RoleFactory } from '#database/factories/role_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import { TenantMembershipFactory } from '#database/factories/tenant_membership_factory'
import { UserFactory } from '#database/factories/user_factory'
import { UserRoleFactory } from '#database/factories/user_role_factory'
import type User from '#modules/auth/models/user'
import type Tenant from '#modules/tenant/models/tenant'
import type Role from '#modules/permission/models/role'
import type TenantMembership from '#modules/tenant/models/tenant_membership'
import type UserRole from '#modules/permission/models/user_role'
import type { PermissionSlug } from '#modules/permission/seeders_data'

const BASE_URL = 'http://localhost:3333'

test.group('DataJud candidate routes', () => {
  test('requires authentication', async ({ assert }) => {
    const response = await apiFetch('/admin/datajud/candidates')

    assert.equal(response.status, 401)
  })

  test('requires an active tenant for authenticated users', async ({ assert }) => {
    const fixture = await createAccessFixture(['integrations.datajud.read'])
    const sessionCookie = await loginAndGetSessionCookie(fixture.user)

    const response = await apiFetch('/admin/datajud/candidates', { sessionCookie })

    assert.equal(response.status, 400)
    assert.equal(response.body.code, 'E_TENANT_REQUIRED')

    await fixture.cleanup()
  })

  test('lists tenant-scoped candidates for read permission holders', async ({ assert }) => {
    const fixture = await createAccessFixture(['integrations.datajud.read'])
    const otherTenant = await TenantFactory.create()
    const candidate = await ProcessMatchCandidateFactory.merge({
      tenantId: fixture.tenant.id,
      candidateCnj: '5004648-91.2022.4.02.5005',
      score: 90,
      status: 'candidate',
    }).create()
    await ProcessMatchCandidateFactory.merge({
      tenantId: otherTenant.id,
      candidateCnj: '5004648-77.2021.4.02.5118',
      score: 95,
      status: 'candidate',
    }).create()
    const sessionCookie = await loginAndGetSessionCookie(fixture.user)

    const response = await apiFetch('/admin/datajud/candidates?status=candidate&minScore=85', {
      sessionCookie,
      tenant: fixture.tenant,
    })
    const candidates = response.body.candidates as Array<{ id: string }>

    assert.equal(response.status, 200)
    assert.deepEqual(
      candidates.map((row) => row.id),
      [candidate.id]
    )

    await fixture.cleanup()
    await otherTenant.delete()
  })

  test('blocks candidate review without manage permission', async ({ assert }) => {
    const fixture = await createAccessFixture(['integrations.datajud.read'])
    const candidate = await ProcessMatchCandidateFactory.merge({
      tenantId: fixture.tenant.id,
      score: 90,
      status: 'candidate',
    }).create()
    const sessionCookie = await loginAndGetSessionCookie(fixture.user)
    const csrfToken = await getCsrfToken(sessionCookie, fixture.tenant)

    const response = await apiFetch(`/admin/datajud/candidates/${candidate.id}/accept`, {
      method: 'POST',
      sessionCookie,
      tenant: fixture.tenant,
      csrfToken,
      body: {},
    })

    assert.equal(response.status, 403)
    assert.equal(response.body.code, 'E_PERMISSION_DENIED')

    await fixture.cleanup()
  })

  test('does not expose candidates from another tenant', async ({ assert }) => {
    const fixture = await createAccessFixture([
      'integrations.datajud.read',
      'integrations.datajud.manage',
    ])
    const otherTenant = await TenantFactory.create()
    const otherCandidate = await ProcessMatchCandidateFactory.merge({
      tenantId: otherTenant.id,
      score: 90,
      status: 'candidate',
    }).create()
    const sessionCookie = await loginAndGetSessionCookie(fixture.user)

    const response = await apiFetch(`/admin/datajud/candidates/${otherCandidate.id}`, {
      sessionCookie,
      tenant: fixture.tenant,
    })

    assert.equal(response.status, 404)

    await fixture.cleanup()
    await otherTenant.delete()
  })

  test('audits accepted candidates and blocks low-score acceptance without force', async ({
    assert,
  }) => {
    const fixture = await createAccessFixture([
      'integrations.datajud.read',
      'integrations.datajud.manage',
    ])
    const asset = await PrecatorioAssetFactory.merge({
      tenantId: fixture.tenant.id,
      source: 'tribunal',
      cnjNumber: '5004648-37.2022.4.02.9388',
    }).create()
    const lowScoreCandidate = await ProcessMatchCandidateFactory.merge({
      tenantId: fixture.tenant.id,
      assetId: asset.id,
      candidateCnj: '5004648-77.2021.4.02.5118',
      candidateDatajudId: 'TRF2_JE_50046487720214025118',
      score: 65,
      status: 'ambiguous',
    }).create()
    const highScoreCandidate = await ProcessMatchCandidateFactory.merge({
      tenantId: fixture.tenant.id,
      assetId: asset.id,
      candidateCnj: '5004648-91.2022.4.02.5005',
      candidateDatajudId: 'TRF2_JE_50046489120224025005',
      score: 90,
      status: 'candidate',
    }).create()
    const sessionCookie = await loginAndGetSessionCookie(fixture.user)
    const csrfToken = await getCsrfToken(sessionCookie, fixture.tenant)

    const blocked = await apiFetch(`/admin/datajud/candidates/${lowScoreCandidate.id}/accept`, {
      method: 'POST',
      sessionCookie,
      tenant: fixture.tenant,
      csrfToken,
      body: {},
    })

    assert.equal(blocked.status, 422)
    assert.equal(blocked.body.code, 'candidate_not_acceptable')

    const accepted = await apiFetch(`/admin/datajud/candidates/${highScoreCandidate.id}/accept`, {
      method: 'POST',
      sessionCookie,
      tenant: fixture.tenant,
      csrfToken,
      requestId: 'http-review-request-1',
      body: {},
    })
    const acceptedCandidate = accepted.body.candidate as { status: string }
    const event = await AssetEvent.query()
      .where('tenant_id', fixture.tenant.id)
      .where('event_type', 'datajud_candidate_accepted')
      .firstOrFail()
    const auditLog = await db
      .from('audit_logs')
      .where('tenant_id', fixture.tenant.id)
      .where('event', 'datajud_candidate_accepted')
      .first()

    assert.equal(accepted.status, 200)
    assert.equal(acceptedCandidate.status, 'accepted')
    assert.equal(event.payload?.reviewedByUserId, fixture.user.id)
    assert.equal(event.payload?.requestId, 'http-review-request-1')
    assert.equal(auditLog?.user_id, fixture.user.id)
    assert.equal(auditLog?.request_id, 'http-review-request-1')

    await fixture.cleanup()
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
        description: 'Generated by DataJud route tests.',
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

async function getCsrfToken(sessionCookie: string, tenant: Tenant) {
  const response = await fetch(url('/admin/datajud/candidates'), {
    headers: {
      'accept': 'application/json',
      'cookie': `adonis-session=${sessionCookie}`,
      'x-tenant-id': tenant.id,
    },
  })
  const xsrfCookie = getCookie(response.headers, 'XSRF-TOKEN')

  if (!xsrfCookie) {
    throw new Error('XSRF-TOKEN cookie was not issued.')
  }

  return xsrfCookie
}

async function apiFetch(
  path: string,
  options: {
    method?: 'GET' | 'POST'
    sessionCookie?: string
    tenant?: Tenant
    csrfToken?: string
    requestId?: string
    body?: Record<string, unknown>
  } = {}
) {
  const headers: Record<string, string> = {
    'accept': 'application/json',
    'content-type': 'application/json',
  }

  if (options.sessionCookie) {
    headers.cookie = `adonis-session=${options.sessionCookie}`
  }

  if (options.tenant) {
    headers['x-tenant-id'] = options.tenant.id
  }

  if (options.csrfToken) {
    headers['x-xsrf-token'] = xsrfTokenHeader(options.csrfToken)
  }

  if (options.requestId) {
    headers['x-request-id'] = options.requestId
  }

  const response = await fetch(url(path), {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
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
