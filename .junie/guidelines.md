# JuridicAI Development Guidelines

This document provides project-specific development guidelines for the JuridicAI multi-tenant law firm management platform.

## Prerequisites

- **Node.js** v18 or higher
- **pnpm** (recommended package manager)
- **PostgreSQL** v14 or higher
- **Redis** (for caching and queue management)
- **Docker** (optional, for containerized development)

## Build and Configuration

### Initial Setup

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Environment configuration:**

   ```bash
   cp .env.example .env
   ```

   **Important:** Generate APP_KEY before running the application:

   ```bash
   node ace generate:key
   ```

3. **Database setup:**

   ```bash
   # Create database
   createdb juridicai_dev

   # Run migrations
   node ace migration:run

   # Seed development data
   node ace db:seed
   ```

### Environment Variables

Key environment variables that must be configured in `.env`:

- **APP_KEY**: Generate with `node ace generate:key` (required for encryption)
- **Database**: `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`
- **Redis**: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- **Mail**: Configure either Mailgun (`MAILGUN_API_KEY`, `MAILGUN_DOMAIN`) or SMTP settings
- **Session**: `SESSION_DRIVER=cookie`
- **Rate Limiting**: `LIMITER_STORE=database`
- **Storage**: `DRIVE_DISK=fs` (or s3, gcs for cloud storage)

### Available Scripts

```bash
# Development
pnpm dev              # Start with HMR (Hot Module Reload)
pnpm start            # Start production server

# Building
pnpm build            # Build for production (output to ./build)

# Code Quality
pnpm lint             # Run ESLint
pnpm lint:fix         # Auto-fix ESLint issues
pnpm format           # Format code with Prettier
pnpm typecheck        # Run TypeScript type checking

# Testing
pnpm test             # Run unit tests
pnpm test:e2e         # Run end-to-end tests

# Database
node ace migration:run      # Run migrations
node ace migration:rollback # Rollback last batch
node ace db:seed            # Seed database

# Docker
pnpm docker           # Run migrations, seed, and start (for Docker)
```

### Import Aliases

The project uses import aliases with `#` prefix for cleaner imports:

```typescript
import User from '#models/user'
import { HttpContext } from '#controllers/http_context'
import TenantService from '#services/tenant_service'
```

Available aliases: `#controllers`, `#models`, `#services`, `#middleware`, `#validators`, `#repositories`, `#policies`, `#abilities`, `#providers`, `#routes`, `#database`, `#tests`, `#start`, `#config`, `#shared`

## Testing

### Testing Framework

The project uses **Japa** as the testing framework with the following plugins:

- `@japa/assert` - Assertions
- `@japa/api-client` - HTTP API testing
- `@japa/plugin-adonisjs` - AdonisJS integration
- `@japa/openapi-assertions` - OpenAPI/Swagger validation

### Test Organization

Tests are organized into two suites:

- **Unit tests**: `tests/unit/**/*.spec.ts` (timeout: 2s)
- **Functional tests**: `tests/functional/**/*.spec.ts` (timeout: 30s)

### Running Tests

```bash
# Run all unit tests
pnpm test

# Run all end-to-end/functional tests
pnpm test:e2e

# Run tests for a specific suite
node ace test unit
node ace test functional
```

### Test Configuration

Tests are configured in:

- `adonisrc.ts` - Test suite definitions
- `tests/bootstrap.ts` - Japa plugins and setup hooks

Test setup automatically:

- Runs database migrations before all tests
- Seeds test data
- Starts HTTP server for functional/e2e tests
- Rolls back migrations after tests complete

### Writing Tests

**Test file naming convention:** `*.spec.ts`

**Basic test structure:**

```typescript
import { test } from '@japa/runner'

test.group('Feature Name', () => {
  test('should perform expected behavior', ({ assert }) => {
    const result = 2 + 2
    assert.equal(result, 4)
  })

  test('should handle async operations', async ({ assert }) => {
    const result = await someAsyncFunction()
    assert.isTrue(result)
  })
})
```

**Available assertions:**

- `assert.equal(actual, expected)`
- `assert.notEqual(actual, expected)`
- `assert.isTrue(value)` / `assert.isFalse(value)`
- `assert.isString(value)` / `assert.isArray(value)`
- `assert.include(collection, item)`
- `assert.lengthOf(collection, length)`
- `assert.throws(() => fn())`

**API testing example:**

```typescript
import { test } from '@japa/runner'

test.group('API Endpoint', () => {
  test('should return users list', async ({ client }) => {
    const response = await client.get('/api/users')

    response.assertStatus(200)
    response.assertBodyContains({ data: [] })
  })
})
```

**Using test utilities:**

```typescript
import testUtils from '@adonisjs/core/services/test_utils'

// Database utilities
await testUtils.db().migrate()
await testUtils.db().seed()
await testUtils.db().truncate()

// HTTP server utilities (for functional tests)
await testUtils.httpServer().start()
```

### Test Utilities

Helper utilities are available in `tests/utils/`:

- `tenant_test_helper.ts` - Multi-tenant testing helpers

## Code Style and Quality

### TypeScript Configuration

The project uses strict TypeScript settings via `@adonisjs/tsconfig/tsconfig.app.json`:

- Strict mode enabled
- Modern ES target
- Output directory: `./build`
- Root directory: `./`

### ESLint

Uses `@adonisjs/eslint-config` with the `configApp` preset.

Run linting:

```bash
pnpm lint          # Check for issues
pnpm lint:fix      # Auto-fix issues
```

### Prettier

Code formatting uses `@adonisjs/prettier-config`.

Format code:

```bash
pnpm format
```

### Pre-commit Checks

Before committing, ensure:

1. TypeScript compiles without errors: `pnpm typecheck`
2. ESLint passes: `pnpm lint`
3. Code is formatted: `pnpm format`
4. Tests pass: `pnpm test`

## Multi-Tenant Architecture

### Key Concepts

This project implements a **multi-tenant SaaS architecture** where each tenant (law firm) has complete data isolation:

- **Tenant-aware models**: Extend `TenantAwareModel` for automatic tenant scoping
- **Tenant context**: Automatically set via middleware based on authenticated user
- **Query scoping**: All database queries automatically filtered by tenant
- **Data isolation**: Prevents data leakage between tenants

### Tenant Context Service

The `TenantContextService` manages the current tenant context:

```typescript
import TenantContextService from '#services/tenant_context_service'

// Set current tenant (usually done by middleware)
TenantContextService.setTenantId(tenantId)

// Get current tenant
const tenantId = TenantContextService.getTenantId()

// Clear tenant context
TenantContextService.clearTenant()
```

### Testing Multi-Tenant Features

When writing tests for multi-tenant features:

1. Use `tenant_test_helper.ts` utilities
2. Always set tenant context before operations
3. Verify data isolation between tenants
4. Test tenant switching scenarios

## Database

### Migrations

```bash
# Create a new migration
node ace make:migration create_table_name

# Run migrations
node ace migration:run

# Rollback last batch
node ace migration:rollback

# Rollback all migrations
node ace migration:rollback --batch=0

# Check migration status
node ace migration:status
```

### Seeders

```bash
# Create a new seeder
node ace make:seeder SeederName

# Run all seeders
node ace db:seed

# Run specific seeder
node ace db:seed --files=database/seeders/UserSeeder.ts
```

### Models

Models should follow these conventions:

- Use `TenantAwareModel` for tenant-scoped data
- Define relationships using decorators (`@hasMany`, `@belongsTo`, etc.)
- Use proper TypeScript typing for columns
- Implement serialization rules for API responses

## AdonisJS-Specific Patterns

### Ace Commands

Custom commands are in `./commands` directory and automatically registered.

Create a new command:

```bash
node ace make:command CommandName
```

### Service Providers

Custom providers in `./providers`:

- `app_provider.ts` - Application-specific setup
- `auth_events_provider.ts` - Authentication event listeners

### Validators

Use VineJS for validation:

```typescript
import vine from '@vinejs/vine'

const schema = vine.object({
  email: vine.string().email(),
  password: vine.string().minLength(8),
})

const validator = vine.compile(schema)
const data = await validator.validate(request.all())
```

### Experimental Features

The project has enabled these experimental AdonisJS features (configured in `adonisrc.ts`):

- `mergeMultipartFieldsAndFiles: true`
- `shutdownInReverseOrder: true`

## Domain-Specific Information

### Brazilian Legal Domain

This project includes specific features for Brazilian legal practice:

- **CPF/CNPJ validation** for person/company identification
- **CNJ case number formatting** (format: NNNNNNN-DD.YYYY.J.TR.OOOO)
- **Audit trails** for compliance requirements
- **Multi-level permissions** for law firm team hierarchy

### Audit Logging

All sensitive operations should be logged using the audit service:

- User actions
- Permission checks
- Data modifications
- Security events

## Development Workflow

1. Create a feature branch from `main`
2. Make your changes following the code style guidelines
3. Write tests for new functionality
4. Run quality checks: `pnpm typecheck && pnpm lint && pnpm test`
5. Commit with descriptive messages
6. Open a pull request

## Troubleshooting

### Common Issues

**APP_KEY not set:**

```bash
node ace generate:key
```

**Database connection errors:**

- Verify PostgreSQL is running
- Check `.env` database credentials
- Ensure database exists: `createdb juridicai_dev`

**Migration errors:**

- Reset database: `node ace migration:rollback --batch=0 && node ace migration:run`
- Check migration order and dependencies

**Test failures:**

- Ensure `.env.test` is configured
- Check test database exists
- Run migrations in test environment

**Redis connection errors:**

- Verify Redis is running: `redis-cli ping`
- Check `REDIS_HOST` and `REDIS_PORT` in `.env`

## Additional Resources

- [AdonisJS Documentation](https://docs.adonisjs.com/)
- [Japa Testing Framework](https://japa.dev/)
- [VineJS Validation](https://vinejs.dev/)
- [Lucid ORM Documentation](https://lucid.adonisjs.com/)
