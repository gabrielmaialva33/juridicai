# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JuridicAI is a multi-tenant SaaS platform for law firm management built with AdonisJS v6. The architecture implements row-level tenant isolation using UUID-based `tenant_id` columns throughout the database, with automatic query scoping via the `withTenantScope` mixin.

## Development Commands

### Essential Commands

```bash
# Development
pnpm dev                           # Start dev server with hot-reload
node ace serve --hmr              # Alternative dev server command

# Testing
pnpm test                         # Run unit tests (SQLite in-memory)
pnpm test:e2e                     # Run all tests including functional
node ace test unit --force-exit   # Direct test execution

# Code Quality
pnpm lint:fix                     # Fix linting issues
pnpm typecheck                    # TypeScript type checking
pnpm format                       # Format with Prettier

# Database
node ace migration:run            # Run pending migrations
node ace migration:rollback      # Rollback last migration batch
node ace migration:fresh          # Drop all tables and re-run migrations
node ace db:seed                  # Seed development data

# Build & Production
pnpm build                        # Build for production
pnpm start                        # Start production server
```

### Code Generation Commands

```bash
# Generate tenant-aware model with migration
node ace make:model Client -m

# Generate controller with resource methods
node ace make:controller clients/clients_controller --resource

# Generate service layer
node ace make:service clients/create_client_service

# Generate validator
node ace make:validator CreateClientValidator

# Generate factory for testing
node ace make:factory Client

# Generate test
node ace make:test clients/create_client --suite=functional
```

## Architecture & Core Patterns

### Multi-Tenant Architecture

The system uses **row-level tenant isolation** with automatic query scoping. Every tenant-scoped table has a `tenant_id` column that's automatically managed.

**Key Components:**

- `withTenantScope` (app/mixins/with_tenant_scope.ts): Mixin that adds tenant isolation to models using compose()
- `TenantContextService` (app/services/tenants/tenant_context_service.ts): Manages tenant context using AsyncLocalStorage
- `TenantResolverMiddleware` (app/middleware/tenant_resolver_middleware.ts): Resolves tenant from headers/subdomain
- `TenantContextException` (app/exceptions/tenant_context_exception.ts): Custom exceptions for tenant-related errors

### Tenant Context Flow

1. **HTTP Request arrives** → `TenantResolverMiddleware` resolves tenant via:
   - `X-Tenant-ID` header (API clients)
   - Subdomain extraction (e.g., acme.juridicai.com.br)
   - User's default tenant (fallback)

2. **Context established** → AsyncLocalStorage maintains tenant context across async operations

3. **Database queries** → All models using `withTenantScope` mixin automatically filter by current tenant

### Creating Tenant-Scoped Models

```typescript
// All tenant-scoped models MUST use the withTenantScope mixin with compose()
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { compose } from '@adonisjs/core/helpers'
import { withTenantScope } from '#mixins/with_tenant_scope'

// Create the tenant-scoped mixin
const TenantScoped = withTenantScope()

export default class Client extends compose(BaseModel, TenantScoped) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: string // Automatically managed - don't set manually

  @column()
  declare full_name: string
}

// Advanced usage with custom options:
const TenantScoped = withTenantScope({
  tenantColumn: 'organization_id', // Custom column name
  strictMode: true, // Throw errors without tenant context
  autoSetOnCreate: true, // Auto-set tenant_id on create
  autoFilter: true, // Auto-filter queries by tenant
})
```

### Working Within Tenant Context

```typescript
// In controllers/services, tenant context is already set by middleware
const clients = await Client.all() // Automatically filtered by current tenant

// For background jobs or CLI commands, manually set context:
await TenantContextService.run(
  { tenant_id: 'uuid', tenant: null, user_id: null, tenant_user: null },
  async () => {
    // All queries here are tenant-scoped
    const client = await Client.create({ full_name: 'John' })
  }
)

// Bypass tenant scoping (admin operations only):
const allClients = await Client.query().apply((scopes) => scopes.withoutTenantScope())
```

### JSONB/Array Column Pattern

PostgreSQL JSONB columns require special handling:

```typescript
@column({
  prepare: (value: Record<string, any> | null) =>
    value ? JSON.stringify(value) : null,
  consume: (value: string | Record<string, any> | null) =>
    value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
})
declare metadata: Record<string, any> | null
```

## Testing Patterns

### Setting Up Tenant Context in Tests

```typescript
import { TenantFactory } from '#database/factories/tenant_factory'
import TenantContextService from '#services/tenants/tenant_context_service'

test('creates client in correct tenant', async ({ assert }) => {
  const tenant = await TenantFactory.create()

  const client = await TenantContextService.run(
    { tenant_id: tenant.id, tenant, user_id: null, tenant_user: null },
    async () => {
      return await ClientFactory.create()
    }
  )

  assert.equal(client.tenant_id, tenant.id)
})
```

## API Structure

All API routes follow `/api/v1/{resource}` pattern with middleware chains:

```typescript
// Tenant-scoped routes require tenant middleware
router.get('/clients', [ClientsController, 'index']).use([middleware.auth(), middleware.tenant()])

// Non-tenant routes don't use tenant middleware
router.get('/tenants', [TenantsController, 'index']).use([middleware.auth()])
```

## Key Middleware Stack

1. **auth**: Validates JWT tokens and loads user
2. **tenant**: Resolves tenant and establishes context (depends on auth)
3. **permission**: Checks user permissions within tenant
4. **ownership**: Validates resource ownership

## Database Considerations

- **Primary Keys**: Use `number` with auto-increment for most tables
- **Tenant IDs**: Always UUID format
- **Indexes**: All tenant-scoped tables have composite indexes starting with `tenant_id`
- **Soft Deletes**: Use `is_active` boolean instead of deletion
- **Timestamps**: All models use `created_at` and `updated_at`

## Brazilian Legal Domain

The system includes specialized support for Brazilian legal entities:

- **CPF/CNPJ Validation**: Built-in validators for tax IDs
- **CNJ Format**: Case numbers follow NNNNNNN-DD.AAAA.J.TR.OOOO pattern
- **Document Types**: Specific enums for Brazilian legal documents
- **Test Factories**: Generate valid CPF/CNPJ with proper checksums

## Error Handling

Custom exceptions extend base classes with proper HTTP status codes:

```typescript
// Use existing exceptions when possible
import NotFoundException from '#exceptions/not_found_exception'
import ConflictException from '#exceptions/conflict_exception'
import ForbiddenException from '#exceptions/forbidden_exception'

// Exceptions automatically convert to proper HTTP responses
throw new NotFoundException('Client not found')
```

## Environment Variables

Key configuration in `.env`:

```env
# Database (PostgreSQL required for production)
DB_CONNECTION=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_DATABASE=juridicai_dev

# Redis (for caching/queues)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Application
APP_KEY=generated_key  # Generate with: node ace generate:key
NODE_ENV=development
```
