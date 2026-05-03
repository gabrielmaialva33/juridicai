import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import Permission from '#modules/permission/models/permission'
import RolePermission from '#modules/permission/models/role_permission'
import GovernmentSourceTarget from '#modules/integrations/models/government_source_target'
import SourceDataset from '#modules/integrations/models/source_dataset'
import SourceRecord from '#modules/siop/models/source_record'
import { RoleFactory } from '#database/factories/role_factory'
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

test.group('Government coverage routes', () => {
  test('requires authentication', async ({ assert }) => {
    const response = await apiFetch('/admin/integrations/coverage')

    assert.equal(response.status, 401)
  })

  test('returns tenant-aware government coverage matrix', async ({ assert }) => {
    const fixture = await createAccessFixture(['imports.read'])
    const otherTenant = await TenantFactory.create()
    const { cleanup } = await createCoverageEvidence(fixture.tenant, otherTenant)
    const sessionCookie = await loginAndGetSessionCookie(fixture.user)

    const response = await apiFetch('/admin/integrations/coverage', {
      sessionCookie,
      tenant: fixture.tenant,
    })
    const acre = response.body.states.find(
      (state: { stateCode: string }) => state.stateCode === 'AC'
    )

    assert.equal(response.status, 200)
    assert.equal(response.body.summary.statesCount, 27)
    assert.equal(acre.primary.status, 'validated')
    assert.equal(acre.primary.tenantSourceRecordsCount, 1)
    assert.equal(acre.intelligence.readyForOperationalScoring, true)
    assert.notInclude(
      response.body.gaps.map(
        (gap: { courtAlias: string; code: string }) => `${gap.courtAlias}:${gap.code}`
      ),
      'tjac:primary_source_missing'
    )

    await cleanup()
    await fixture.cleanup()
    await otherTenant.delete()
  })
})

async function createCoverageEvidence(tenant: Tenant, otherTenant: Tenant) {
  const suffix = tenant.id
  const primaryDataset = await createDataset({
    key: `coverage-route-primary-${suffix}`,
    source: 'tribunal',
    priority: 'primary',
  })
  const dataJudDataset = await createDataset({
    key: `coverage-route-datajud-${suffix}`,
    source: 'datajud',
    priority: 'enrichment',
  })
  const djenDataset = await createDataset({
    key: `coverage-route-djen-${suffix}`,
    source: 'djen',
    priority: 'enrichment',
  })
  const primaryTarget = await createTarget({
    sourceDatasetId: primaryDataset.id,
    key: `coverage-route:tjac-primary:${suffix}`,
    source: 'tribunal',
    priority: 'primary',
    adapterKey: 'test_tjac_precatorio_sync',
    sourceUrl: 'https://example.test/tjac/precatorios',
    lastDiscoveredCount: 11,
    lastSourceRecordsCount: 2,
  })
  const dataJudTarget = await createTarget({
    sourceDatasetId: dataJudDataset.id,
    key: `coverage-route:tjac-datajud:${suffix}`,
    source: 'datajud',
    priority: 'enrichment',
    adapterKey: 'datajud_precatorio_discovery',
    sourceUrl: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjac/_search',
    lastDiscoveredCount: 7,
    lastSourceRecordsCount: 1,
  })
  const djenTarget = await createTarget({
    sourceDatasetId: djenDataset.id,
    key: `coverage-route:tjac-djen:${suffix}`,
    source: 'djen',
    priority: 'enrichment',
    adapterKey: 'djen_publication_sync',
    sourceUrl: 'https://comunicaapi.pje.jus.br/api/v1/comunicacao',
    lastDiscoveredCount: 5,
    lastSourceRecordsCount: 1,
  })
  const tenantRecord = await createSourceRecord(
    tenant,
    primaryDataset.id,
    `coverage-route-${suffix}`
  )
  const otherTenantRecord = await createSourceRecord(
    otherTenant,
    primaryDataset.id,
    `coverage-route-other-${suffix}`
  )

  return {
    async cleanup() {
      await tenantRecord.delete()
      await otherTenantRecord.delete()
      await primaryTarget.delete()
      await dataJudTarget.delete()
      await djenTarget.delete()
      await primaryDataset.delete()
      await dataJudDataset.delete()
      await djenDataset.delete()
    },
  }
}

async function createDataset(input: {
  key: string
  source: 'tribunal' | 'datajud' | 'djen'
  priority: 'primary' | 'enrichment'
}) {
  return SourceDataset.create({
    key: input.key,
    name: input.key,
    owner: 'Coverage Route Test',
    source: input.source,
    federativeLevel: 'state',
    kind: input.source === 'datajud' ? 'public_search_api' : 'tribunal_publication',
    access: 'public',
    priority: input.priority,
    baseUrl: 'https://example.test',
    stateCode: 'AC',
    courtAlias: 'tjac',
    format: input.source === 'datajud' ? 'json' : 'html/csv',
    notes: 'Generated by coverage route tests.',
    metadata: { testRun: true },
    isActive: true,
  })
}

async function createTarget(input: {
  sourceDatasetId: string
  key: string
  source: 'tribunal' | 'datajud' | 'djen'
  priority: 'primary' | 'enrichment'
  adapterKey: string
  sourceUrl: string
  lastDiscoveredCount: number
  lastSourceRecordsCount: number
}) {
  return GovernmentSourceTarget.create({
    sourceDatasetId: input.sourceDatasetId,
    key: input.key,
    name: input.key,
    source: input.source,
    federativeLevel: 'state',
    stateCode: 'AC',
    courtAlias: 'tjac',
    branch: 'state_court',
    priority: input.priority,
    adapterKey: input.adapterKey,
    sourceUrl: input.sourceUrl,
    sourceFormat: input.source === 'datajud' ? 'json' : 'html/csv',
    status: 'implemented',
    cadence: 'daily',
    isActive: true,
    lastSuccessAt: DateTime.now(),
    lastDiscoveredCount: input.lastDiscoveredCount,
    lastSourceRecordsCount: input.lastSourceRecordsCount,
    coverageScore: '0.9900',
    metadata: { testRun: true },
  })
}

async function createSourceRecord(tenant: Tenant, sourceDatasetId: string, checksum: string) {
  return SourceRecord.create({
    tenantId: tenant.id,
    sourceDatasetId,
    source: 'tribunal',
    sourceUrl: 'https://example.test/tjac/precatorios/lista.csv',
    sourceChecksum: checksum,
    originalFilename: 'lista.csv',
    mimeType: 'text/csv',
    fileSizeBytes: 128,
    collectedAt: DateTime.now(),
    rawData: { courtAlias: 'tjac' },
  })
}

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
        description: 'Generated by government coverage route tests.',
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
