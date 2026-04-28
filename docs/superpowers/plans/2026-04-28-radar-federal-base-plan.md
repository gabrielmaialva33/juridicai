# Radar Federal Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:
> executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o monolito juridicai/v0 (Spec 1 — Radar Federal Base) que ingere todo histórico SIOP federal,
persiste em PostgreSQL multi-tenant com PII bunker isolada, e expõe dashboard read-only Inertia.

**Architecture:** AdonisJS 7 monolito modular (`app/modules/<domain>` + `app/shared/`), Inertia + React + Metronic (
frontend), Lucid + PostgreSQL + RLS seletivo, BullMQ + Redis (workers separados), VineJS validators, audit append-only
via PG RULES, pii.\* schema com `SECURITY DEFINER` reveal function.

**Tech Stack:** Adonis 7.3 · Inertia 4 · React 19 · Lucid 22 · PostgreSQL 15+ · Redis 7 · BullMQ 5 · VineJS 4.3 ·
Bouncer · Drive · adonisjs-scheduler · exceljs · TanStack Table · radix-ui · ApexCharts · Sonner · pino · Japa +
Playwright.

**Spec:** `docs/superpowers/specs/2026-04-28-radar-federal-base-design.md`.

---

## Working Notes

**Convenções de commit:** gitmoji prefix (padrão eduguard) — `🚀 feat:`, `🐛 fix:`, `💄 style:`, `🔧 chore:`, `🌱 seed:`,
`🗃️ refactor(db):`, `♻️ refactor:`, `✅ test:`, `📝 docs:`, `🔒 security:`. Concise, "why" not "what".

**TDD strict** em: parsers, normalizers, services com regra de negócio, helpers (`sanitizeError`, `withTenantRls`,
`HashService`), middleware (`tenant`, `request_id`).

**TDD relaxado** (write → run → verify → commit, sem failing-first) em: migrations, seeders, configs, view files
Inertia.

**Generators obrigatórios:** `node ace make:migration <name>`, `node ace make:model <Name>`,
`node ace make:controller <Name>`, `node ace make:middleware <name>`, `node ace make:command <name>`,
`node ace make:factory <Model>`. Nunca criar manualmente.

**Multi-tenant:** toda query de domínio passa por `BaseRepository.query(tenantId)`. Nunca query nua. Tests de
cross-tenant são must-pass na CI.

**Hot reload:** o starter usa `hot-hook`. Boundaries em `package.json` cobrem `app/controllers/**` e `app/middleware/*`.
Adicionar `app/modules/**/controllers/*.ts` quando módulos forem criados.

**Estrutura adicional:** o starter já tem `app/{controllers, middleware, models, validators, exceptions, transformers}/`
flat. Vamos **adicionar** (não substituir) `app/modules/<domain>/` e `app/shared/` ao lado. Coisas verdadeiramente
cross-cutting (ex: `silent_auth_middleware`) ficam em `app/middleware/`. Coisas reutilizáveis em domínios (
`base_repository`, `tenant_context`) vão em `app/shared/`.

**Path imports:** adicionar `#modules/*` e `#shared/*` ao `package.json`. Manter os existentes (`#controllers/*`,
`#models/*`, etc) pra não quebrar starter.

**Branching:** trabalhar em `main` por enquanto (greenfield). Depois adotar feature branches por phase.

---

## File Structure (decomposição alvo)

```
juridicai/
├── app/
│   ├── exceptions/                          # estende handler.ts existente
│   │   ├── handler.ts                       # já existe; vamos modificar
│   │   ├── domain_exceptions.ts             # NEW: hierarquia E_*
│   │   └── error_codes.ts                   # NEW: enum de codes
│   ├── middleware/                          # já existe; flat global
│   │   ├── auth_middleware.ts               # já existe (starter)
│   │   ├── silent_auth_middleware.ts        # já existe
│   │   ├── guest_middleware.ts              # já existe
│   │   ├── container_bindings_middleware.ts # já existe
│   │   ├── inertia_middleware.ts            # já existe
│   │   ├── request_id_middleware.ts         # NEW
│   │   ├── tenant_middleware.ts             # NEW
│   │   ├── permission_middleware.ts         # NEW
│   │   └── inertia_share_middleware.ts      # NEW
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── controllers/login_controller.ts
│   │   │   ├── controllers/logout_controller.ts
│   │   │   ├── validators/login_validator.ts
│   │   │   └── routes.ts
│   │   ├── tenant/
│   │   │   ├── controllers/tenant_select_controller.ts
│   │   │   ├── services/membership_service.ts
│   │   │   └── routes.ts
│   │   ├── permission/
│   │   │   └── seeders_data.ts              # listas de permissions e roles
│   │   ├── siop/
│   │   │   ├── controllers/import_controller.ts
│   │   │   ├── parsers/cnj_parser.ts
│   │   │   ├── parsers/value_parser.ts
│   │   │   ├── parsers/debtor_normalizer.ts
│   │   │   ├── services/siop_import_service.ts
│   │   │   ├── services/siop_normalize_service.ts
│   │   │   ├── jobs/siop_import_handler.ts
│   │   │   ├── jobs/siop_reprocess_handler.ts
│   │   │   ├── jobs/siop_reconcile_handler.ts
│   │   │   ├── validators/upload_validator.ts
│   │   │   └── routes.ts
│   │   ├── precatorios/
│   │   │   ├── controllers/precatorios_controller.ts
│   │   │   ├── repositories/precatorio_repository.ts
│   │   │   ├── services/precatorio_service.ts
│   │   │   └── routes.ts
│   │   ├── debtors/
│   │   │   ├── controllers/debtors_controller.ts
│   │   │   ├── repositories/debtor_repository.ts
│   │   │   └── routes.ts
│   │   ├── pii/
│   │   │   ├── controllers/reveal_controller.ts
│   │   │   ├── services/hash_service.ts
│   │   │   ├── services/reveal_service.ts
│   │   │   ├── policies/pii_policy.ts
│   │   │   └── routes.ts
│   │   ├── exports/
│   │   │   ├── controllers/exports_controller.ts
│   │   │   ├── jobs/export_precatorios_handler.ts
│   │   │   └── routes.ts
│   │   ├── maintenance/
│   │   │   ├── jobs/purge_staging_handler.ts
│   │   │   ├── jobs/apply_retention_policy_handler.ts
│   │   │   ├── jobs/refresh_aggregates_handler.ts
│   │   │   └── jobs/vacuum_hint_handler.ts
│   │   ├── dashboard/
│   │   │   ├── controllers/dashboard_controller.ts
│   │   │   └── repositories/metrics_repository.ts
│   │   ├── admin/
│   │   │   ├── controllers/health_controller.ts
│   │   │   ├── controllers/jobs_controller.ts
│   │   │   └── routes.ts
│   │   ├── healthcheck/
│   │   │   └── controllers/healthz_controller.ts
│   │   └── client_errors/
│   │       └── controllers/client_errors_controller.ts
│   └── shared/
│       ├── helpers/
│       │   ├── tenant_context.ts            # AsyncLocalStorage
│       │   ├── with_tenant_rls.ts
│       │   ├── sanitize_error.ts
│       │   ├── timed.ts
│       │   ├── error_messages.ts            # mapCodeToMessage
│       │   └── safe_json_view.ts            # server-side mask
│       ├── models/
│       │   ├── tenant_base_model.ts         # com soft delete
│       │   └── tenant_model.ts              # sem soft delete
│       ├── repositories/
│       │   └── base_repository.ts
│       ├── services/
│       │   ├── audit_service.ts
│       │   ├── job_run_service.ts
│       │   ├── permission_cache_service.ts
│       │   ├── queue_service.ts
│       │   └── feature_flag_service.ts
│       └── types/
│           └── inertia.ts
│
├── config/
│   ├── auth.ts                              # já existe
│   ├── bodyparser.ts                        # já existe
│   ├── cors.ts                              # já existe
│   ├── database.ts                          # MODIFY: trocar sqlite → pg + afterCreate hook
│   ├── encryption.ts                        # já existe
│   ├── hash.ts                              # já existe
│   ├── inertia.ts                           # já existe (modificar)
│   ├── logger.ts                            # MODIFY: redaction expandido
│   ├── session.ts                           # já existe (modificar pra Redis driver)
│   ├── shield.ts                            # já existe
│   ├── static.ts                            # já existe
│   ├── vite.ts                              # já existe
│   ├── bouncer.ts                           # NEW (depois de instalar @adonisjs/bouncer)
│   ├── drive.ts                             # NEW (depois de instalar @adonisjs/drive)
│   └── redis.ts                             # NEW (depois de instalar @adonisjs/redis)
│
├── database/
│   ├── migrations/                          # 35+ migrations a criar
│   ├── seeders/
│   │   ├── index_seeder.ts
│   │   ├── permissions_seeder.ts
│   │   ├── roles_seeder.ts
│   │   ├── tenant_benicio_seeder.ts
│   │   └── retention_config_seeder.ts
│   └── factories/
│       ├── tenant_factory.ts
│       ├── user_factory.ts
│       └── precatorio_asset_factory.ts
│
├── inertia/
│   ├── app.tsx                              # MODIFY: ErrorBoundary
│   ├── client.ts                            # já existe
│   ├── ssr.tsx                              # já existe
│   ├── components/
│   │   ├── layout/                          # adaptados Metronic
│   │   ├── ui/                              # primitives radix
│   │   ├── data-table/                      # TanStack adapter
│   │   ├── charts/
│   │   ├── states/
│   │   │   ├── empty_state.tsx
│   │   │   ├── loading_state.tsx
│   │   │   ├── error_state.tsx
│   │   │   └── denied_state.tsx
│   │   ├── pii/
│   │   │   ├── reveal_dialog.tsx
│   │   │   └── safe_json_view.tsx
│   │   └── tenant_switcher.tsx
│   ├── hooks/
│   │   ├── use_permissions.ts
│   │   ├── use_import_polling.ts
│   │   └── use_request_id.ts
│   ├── pages/
│   │   ├── auth/login.tsx
│   │   ├── tenants/select.tsx
│   │   ├── dashboard/index.tsx
│   │   ├── imports/{index, new, show, errors}.tsx
│   │   ├── precatorios/{index, show}.tsx
│   │   ├── debtors/{index, show}.tsx
│   │   ├── admin/{health, jobs}.tsx
│   │   ├── settings/{tenant, users}.tsx
│   │   └── errors/show.tsx
│   ├── layouts/
│   │   ├── default_layout.tsx
│   │   └── auth_layout.tsx
│   └── lib/
│       ├── axios_client.ts                  # CSRF + request_id
│       └── permissions.ts
│
├── start/
│   ├── env.ts                               # MODIFY: novas envs
│   ├── kernel.ts                            # MODIFY: registrar middleware novos
│   ├── routes.ts                            # MODIFY: importar routes de cada módulo
│   ├── validator.ts                         # já existe
│   ├── jobs.ts                              # NEW: bootWorkers
│   └── scheduler.ts                         # NEW
│
├── bin/
│   ├── server.js                            # já existe
│   └── worker.ts                            # NEW
│
├── docker-compose.yml                       # NEW
├── .env.example                             # MODIFY
└── tests/
    ├── bootstrap.ts                         # já existe (modificar)
    ├── factories/
    ├── fixtures/siop/
    ├── unit/
    ├── integration/
    ├── functional/
    ├── e2e/
    └── performance/
```

---

## Phase 0 — Preparação do ambiente

### Task 1: Migrar de npm → pnpm e ajustar imports

**Files:**

- Delete: `package-lock.json`
- Create: `pnpm-workspace.yaml`
- Modify: `package.json` (imports section)

- [ ] **Step 1: Instalar pnpm globalmente (se não tiver)**

```bash
which pnpm || npm install -g pnpm@latest
pnpm --version
```

Expected: imprime versão >= 9

- [ ] **Step 2: Remover node_modules e package-lock**

```bash
rm -rf node_modules package-lock.json
```

- [ ] **Step 3: Criar pnpm-workspace.yaml**

```yaml
packages:
  - .
```

- [ ] **Step 4: Adicionar imports modulares no package.json**

Localizar em `package.json` o bloco `"imports": { ... }`. Adicionar duas entradas no objeto:

```json
"#modules/*": "./app/modules/*.js",
"#shared/*": "./app/shared/*.js",
```

(manter as outras linhas existentes — `#controllers/*`, `#models/*`, etc)

- [ ] **Step 5: Reinstalar com pnpm**

```bash
pnpm install
```

Expected: cria `pnpm-lock.yaml`, `node_modules/.pnpm`, sem erros.

- [ ] **Step 6: Verificar dev server ainda sobe**

```bash
pnpm dev &
sleep 5
curl -s http://localhost:3333 | head -5
kill %1
```

Expected: resposta HTML do Adonis.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml
git rm package-lock.json
git commit -m "🔧 chore: switch to pnpm and add #modules/#shared path imports"
```

---

### Task 2: Trocar SQLite por PostgreSQL e instalar dependências core

**Files:**

- Modify: `package.json`
- Modify: `config/database.ts`
- Modify: `start/env.ts`

- [ ] **Step 1: Instalar drivers e libs essenciais**

```bash
pnpm add pg luxon
pnpm add -D @types/pg
pnpm remove better-sqlite3
```

- [ ] **Step 2: Instalar Adonis packages adicionais**

```bash
pnpm add @adonisjs/redis @adonisjs/bouncer @adonisjs/drive bullmq adonisjs-scheduler exceljs ioredis
pnpm add -D @types/luxon
```

- [ ] **Step 3: Configurar @adonisjs/redis**

```bash
node ace add @adonisjs/redis
```

Quando perguntar configuração, escolher `main` connection com host/port do Redis local.

- [ ] **Step 4: Configurar @adonisjs/bouncer**

```bash
node ace add @adonisjs/bouncer
```

- [ ] **Step 5: Configurar @adonisjs/drive**

```bash
node ace add @adonisjs/drive
```

Escolher driver `fs` (FileSystem) pra dev local.

- [ ] **Step 6: Atualizar config/database.ts pra PostgreSQL**

Substituir o conteúdo de `config/database.ts`:

```typescript
import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

const dbConfig = defineConfig({
  connection: 'postgres',
  connections: {
    postgres: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD'),
        database: env.get('DB_DATABASE'),
      },
      pool: {
        afterCreate: (conn: any, done: any) => {
          const piiKey = env.get('PII_ENCRYPTION_KEY')
          if (piiKey) {
            conn.query(`select set_config('app.pii_encryption_key', $1, false)`, [piiKey], done)
          } else {
            done(null, conn)
          }
        },
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      seeders: {
        paths: ['database/seeders'],
      },
    },
  },
})

export default dbConfig
```

- [ ] **Step 7: Atualizar start/env.ts pras novas envs**

Localizar o `Env.create` e adicionar/modificar dentro do schema:

```typescript
DB_HOST: Env.schema.string({format: 'host'}),
  DB_PORT
:
Env.schema.number(),
  DB_USER
:
Env.schema.string(),
  DB_PASSWORD
:
Env.schema.string.optional(),
  DB_DATABASE
:
Env.schema.string(),

  REDIS_HOST
:
Env.schema.string({format: 'host'}),
  REDIS_PORT
:
Env.schema.number(),
  REDIS_PASSWORD
:
Env.schema.string.optional(),

  PII_HASH_PEPPER
:
Env.schema.string(),
  PII_ENCRYPTION_KEY
:
Env.schema.string(),

  DRIVE_DISK
:
Env.schema.enum(['fs', 's3'] as const),
```

(manter as variáveis que o starter já tinha)

- [ ] **Step 8: Atualizar `.env` e `.env.example`**

Em `.env.example`:

```
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=juridicai
DB_PASSWORD=juridicai
DB_DATABASE=juridicai_dev

REDIS_HOST=127.0.0.1
REDIS_PORT=6379

PII_HASH_PEPPER=replace-with-32-bytes-hex
PII_ENCRYPTION_KEY=replace-with-32-bytes-hex

DRIVE_DISK=fs
```

E gerar valores reais no `.env`:

```bash
echo "PII_HASH_PEPPER=$(openssl rand -hex 32)" >> .env
echo "PII_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
```

(adicionar manualmente as outras envs do exemplo no .env)

- [ ] **Step 9: Configurar session driver pra Redis**

Editar `config/session.ts`, mudar `driver` pra `redis` e `connection` pra `'main'`:

```typescript
driver: env.get('SESSION_DRIVER', 'redis'),
  connection
:
'main',
```

Adicionar em `start/env.ts`:

```typescript
SESSION_DRIVER: Env.schema.enum(['cookie', 'redis', 'memory'] as const),
```

E em `.env`:

```
SESSION_DRIVER=redis
```

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "🔧 chore: switch to PostgreSQL + Redis, install core deps (bullmq, drive, bouncer, scheduler)"
```

---

### Task 3: Docker Compose para dev local

**Files:**

- Create: `docker-compose.yml`
- Create: `.dockerignore`

- [ ] **Step 1: Criar docker-compose.yml**

```yaml
services:
  postgres:
    image: timescale/timescaledb-ha:pg17
    environment:
      POSTGRES_USER: juridicai
      POSTGRES_PASSWORD: juridicai
      POSTGRES_DB: juridicai_dev
      TIMESCALEDB_TELEMETRY: 'off'
    ports:
      - '127.0.0.1:5432:5432'
    volumes:
      - juridicai_pgdata:/home/postgres/pgdata/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U juridicai -d juridicai_dev']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    ports:
      - '127.0.0.1:6379:6379'
    volumes:
      - juridicai_redisdata:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  juridicai_pgdata:
  juridicai_redisdata:
```

- [ ] **Step 2: Criar .dockerignore**

```
node_modules
build
.env
.env.local
.git
storage/logs
tests/fixtures/**/*.xlsx
```

- [ ] **Step 3: Subir e testar**

```bash
docker compose up -d
docker compose ps
```

Expected: ambos `postgres` e `redis` healthy.

- [ ] **Step 4: Validar conexão**

```bash
docker compose exec postgres psql -U juridicai -d juridicai_dev -c 'select version();'
docker compose exec redis redis-cli ping
```

Expected: versão Postgres + `PONG`.

Extra check for this project: `select extname, extversion from pg_extension where extname = 'timescaledb';` should
return `timescaledb`.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml .dockerignore
git commit -m "🔧 chore: add docker-compose with postgres and redis"
```

---

### Task 4: Configurar logger.ts com redaction expandida

**Files:**

- Modify: `config/logger.ts`

- [ ] **Step 1: Substituir config/logger.ts**

```typescript
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, targets } from '@adonisjs/core/logger'

export default defineConfig({
  default: 'app',
  loggers: {
    app: {
      enabled: true,
      name: env.get('APP_NAME'),
      level: env.get('LOG_LEVEL'),
      transport: {
        targets: targets()
          .pushIf(!app.inProduction, targets.pretty())
          .pushIf(app.inProduction, targets.file({ destination: 'storage/logs/app.log' }))
          .toArray(),
      },
      redact: {
        paths: [
          'password',
          'secret',
          'token',
          '*.password',
          '*.secret',
          '*.token',
          'cpf',
          'cnpj',
          'document',
          '*.cpf',
          '*.cnpj',
          '*.document',
          'email',
          'phone',
          'telefone',
          '*.email',
          '*.phone',
          '*.telefone',
          'name_encrypted',
          'document_encrypted',
          'beneficiary.*',
          'beneficiaries.*',
          'beneficiario.*',
          'beneficiarios.*',
          'pii.*',
          'raw_data.beneficiarios',
          'raw_data.beneficiaries',
          'headers.authorization',
          'headers.cookie',
          'headers.set-cookie',
          'headers.x-api-key',
          'apiKey',
          'access_token',
          'refresh_token',
        ],
        remove: true,
      },
    },
  },
})
```

- [ ] **Step 2: Garantir LOG_LEVEL e APP_NAME no env**

Em `start/env.ts`:

```typescript
APP_NAME: Env.schema.string(),
  LOG_LEVEL
:
Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const),
```

Em `.env.example`:

```
APP_NAME=juridicai
LOG_LEVEL=info
```

- [ ] **Step 3: Verificar pnpm dev sobe sem erro**

```bash
pnpm dev &
sleep 5
curl -s http://localhost:3333 -o /dev/null -w "%{http_code}\n"
kill %1
```

Expected: `200`.

- [ ] **Step 4: Commit**

```bash
git add config/logger.ts start/env.ts .env.example
git commit -m "🔒 security: configure pino redaction for PII paths"
```

---

### Task 5: Criar .env.example completo e validar bootstrap

**Files:**

- Modify: `.env.example`
- Modify: `.gitignore` (verificar)

- [ ] **Step 1: Conteúdo completo do .env.example**

```env
TZ=America/Sao_Paulo
PORT=3333
HOST=0.0.0.0
LOG_LEVEL=info
APP_KEY=replace-with-32-chars-secret
APP_NAME=juridicai
NODE_ENV=development

DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=juridicai
DB_PASSWORD=juridicai
DB_DATABASE=juridicai_dev

REDIS_HOST=127.0.0.1
REDIS_PORT=6379

SESSION_DRIVER=redis

PII_HASH_PEPPER=replace-with-32-bytes-hex
PII_ENCRYPTION_KEY=replace-with-32-bytes-hex

DRIVE_DISK=fs
```

- [ ] **Step 2: Verificar .gitignore inclui .env**

```bash
grep -E "^\.env$" .gitignore || echo ".env" >> .gitignore
grep -E "^node_modules" .gitignore || echo "node_modules" >> .gitignore
```

- [ ] **Step 3: Garantir .env tem todas as variáveis**

Copia do exemplo e ajusta:

```bash
cp .env.example .env.tmp
# preserva valores existentes do .env (incluindo PII_*) sobrescrevendo o .tmp
# manualmente revisar e ajustar
```

(processo manual; verificar que `APP_KEY`, `PII_HASH_PEPPER`, `PII_ENCRYPTION_KEY` estão preenchidos)

- [ ] **Step 4: Bootar o app + worker stub**

```bash
pnpm dev
```

Expected: `info: HTTP server started ... :3333` no log.

- [ ] **Step 5: Commit**

```bash
git add .env.example .gitignore
git commit -m "🔧 chore: complete .env.example with all required variables"
```

---

## Phase 1 — Foundation `app/shared/`

### Task 6: Criar TenantContext (AsyncLocalStorage)

**Files:**

- Create: `app/shared/helpers/tenant_context.ts`
- Create: `tests/unit/shared/helpers/tenant_context.spec.ts`

- [ ] **Step 1: Criar test failing**

```typescript
// tests/unit/shared/helpers/tenant_context.spec.ts
import { test } from '@japa/runner'
import TenantContext from '#shared/helpers/tenant_context'

test.group('TenantContext', () => {
  test('TenantContext.get() throws when called outside run()', ({ assert }) => {
    assert.throws(() => TenantContext.get(), 'tenant context unavailable')
  })

  test('TenantContext.run propagates tenant id within callback', async ({ assert }) => {
    const result = await TenantContext.run('tenant-a', async () => {
      return TenantContext.get()
    })
    assert.equal(result, 'tenant-a')
  })

  test('TenantContext isolates concurrent runs', async ({ assert }) => {
    const [a, b] = await Promise.all([
      TenantContext.run('tenant-a', async () => {
        await new Promise((r) => setTimeout(r, 10))
        return TenantContext.get()
      }),
      TenantContext.run('tenant-b', async () => {
        return TenantContext.get()
      }),
    ])
    assert.equal(a, 'tenant-a')
    assert.equal(b, 'tenant-b')
  })

  test('TenantContext.tryGet returns null outside run', ({ assert }) => {
    assert.isNull(TenantContext.tryGet())
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
pnpm test --files="tests/unit/shared/helpers/tenant_context.spec.ts"
```

Expected: FAIL — `Cannot find module '#shared/helpers/tenant_context'`.

- [ ] **Step 3: Implementar TenantContext**

```typescript
// app/shared/helpers/tenant_context.ts
import { AsyncLocalStorage } from 'node:async_hooks'

const storage = new AsyncLocalStorage<{ tenantId: string }>()

class TenantContext {
  run<T>(tenantId: string, fn: () => Promise<T> | T): Promise<T> | T {
    return storage.run({ tenantId }, fn)
  }

  get(): string {
    const store = storage.getStore()
    if (!store) {
      throw new Error('tenant context unavailable')
    }
    return store.tenantId
  }

  tryGet(): string | null {
    const store = storage.getStore()
    return store ? store.tenantId : null
  }
}

export default new TenantContext()
```

- [ ] **Step 4: Run test passing**

```bash
pnpm test --files="tests/unit/shared/helpers/tenant_context.spec.ts"
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/shared/helpers/tenant_context.ts tests/unit/shared/helpers/tenant_context.spec.ts
git commit -m "🚀 feat(shared): TenantContext via AsyncLocalStorage"
```

---

### Task 7: Helper `withTenantRls`

**Files:**

- Create: `app/shared/helpers/with_tenant_rls.ts`
- Create: `tests/integration/shared/with_tenant_rls.spec.ts`

- [ ] **Step 1: Criar integration test (requer DB up)**

```typescript
// tests/integration/shared/with_tenant_rls.spec.ts
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { withTenantRls } from '#shared/helpers/with_tenant_rls'

test.group('withTenantRls', (group) => {
  group.each.setup(async () => {
    // garantir que setting está limpo entre testes
    await db.rawQuery(`select set_config('app.current_tenant_id', '', false)`)
  })

  test('sets app.current_tenant_id within transaction', async ({ assert }) => {
    const result = await withTenantRls('00000000-0000-0000-0000-000000000001', async (trx) => {
      const r = await trx.rawQuery(`select current_setting('app.current_tenant_id', true) as v`)
      return r.rows[0].v
    })
    assert.equal(result, '00000000-0000-0000-0000-000000000001')
  })

  test('reverts setting after transaction', async ({ assert }) => {
    await withTenantRls('00000000-0000-0000-0000-000000000002', async () => {})
    const r = await db.rawQuery(`select current_setting('app.current_tenant_id', true) as v`)
    assert.equal(r.rows[0].v, '')
  })

  test('rolls back on exception', async ({ assert }) => {
    await assert.rejects(async () => {
      await withTenantRls('00000000-0000-0000-0000-000000000003', async (trx) => {
        await trx.rawQuery(`create table _tmp_test_table (id int)`)
        throw new Error('rollback')
      })
    })
    const r = await db.rawQuery(`select to_regclass('_tmp_test_table') as v`)
    assert.isNull(r.rows[0].v)
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm test --files="tests/integration/shared/with_tenant_rls.spec.ts"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implementar**

```typescript
// app/shared/helpers/with_tenant_rls.ts
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export async function withTenantRls<T>(
  tenantId: string,
  callback: (trx: TransactionClientContract) => Promise<T>
): Promise<T> {
  return db.transaction(async (trx) => {
    await trx.rawQuery(`select set_config('app.current_tenant_id', ?, true)`, [tenantId])
    return callback(trx)
  })
}
```

- [ ] **Step 4: Run passing**

```bash
pnpm test --files="tests/integration/shared/with_tenant_rls.spec.ts"
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/shared/helpers/with_tenant_rls.ts tests/integration/shared/with_tenant_rls.spec.ts
git commit -m "🚀 feat(shared): withTenantRls helper for RLS-aware transactions"
```

---

### Task 8: Helpers utilitários (`sanitize_error`, `timed`, `error_messages`)

**Files:**

- Create: `app/shared/helpers/sanitize_error.ts`
- Create: `app/shared/helpers/timed.ts`
- Create: `app/shared/helpers/error_messages.ts`
- Create: `tests/unit/shared/helpers/sanitize_error.spec.ts`
- Create: `tests/unit/shared/helpers/timed.spec.ts`

- [ ] **Step 1: Test sanitizeError**

```typescript
// tests/unit/shared/helpers/sanitize_error.spec.ts
import { test } from '@japa/runner'
import { sanitizeError } from '#shared/helpers/sanitize_error'

test.group('sanitizeError', () => {
  test('truncates stack to 50 lines', ({ assert }) => {
    const err = new Error('boom')
    err.stack = Array.from({ length: 100 }, (_, i) => `at line ${i}`).join('\n')
    const out = sanitizeError(err, { mode: 'prod' })
    assert.lengthOf(out.stack!.split('\n'), 50)
  })

  test('removes absolute paths in prod', ({ assert }) => {
    const err = new Error('boom')
    err.stack = 'Error: boom\n    at Foo (/home/user/project/file.ts:1:1)'
    const out = sanitizeError(err, { mode: 'prod' })
    assert.notInclude(out.stack!, '/home/user')
  })

  test('returns full stack in dev', ({ assert }) => {
    const err = new Error('boom')
    err.stack = 'long-stack-here'
    const out = sanitizeError(err, { mode: 'dev' })
    assert.equal(out.stack, 'long-stack-here')
  })

  test('hashes stack into stack_hash', ({ assert }) => {
    const err = new Error('boom')
    err.stack = 'foo\nbar'
    const out = sanitizeError(err, { mode: 'prod' })
    assert.match(out.stackHash!, /^[a-f0-9]{64}$/)
  })
})
```

- [ ] **Step 2: Test timed**

```typescript
// tests/unit/shared/helpers/timed.spec.ts
import { test } from '@japa/runner'
import { timed } from '#shared/helpers/timed'

test.group('timed', () => {
  test('returns the awaited value', async ({ assert }) => {
    const result = await timed('test', async () => 42)
    assert.equal(result, 42)
  })

  test('rethrows errors', async ({ assert }) => {
    await assert.rejects(() =>
      timed('test', async () => {
        throw new Error('x')
      })
    )
  })

  test('completes for normal calls without crashing', async ({ assert }) => {
    const result = await timed('label', async () => 'ok', 1)
    assert.equal(result, 'ok')
  })
})
```

- [ ] **Step 3: Run failing**

```bash
pnpm test --files="tests/unit/shared/helpers/sanitize_error.spec.ts" --files="tests/unit/shared/helpers/timed.spec.ts"
```

Expected: FAIL — modules not found.

- [ ] **Step 4: Implementar sanitize_error**

```typescript
// app/shared/helpers/sanitize_error.ts
import { createHash } from 'node:crypto'

interface SanitizeOptions {
  mode: 'dev' | 'prod'
  maxStackLines?: number
}

interface SanitizedError {
  message: string
  code?: string
  stack?: string
  stackHash?: string
}

export function sanitizeError(err: any, opts: SanitizeOptions): SanitizedError {
  const out: SanitizedError = {
    message: err?.message ?? 'unknown',
    code: err?.code,
  }
  const stack: string | undefined = err?.stack
  if (stack) {
    out.stackHash = createHash('sha256').update(stack).digest('hex')
    if (opts.mode === 'dev') {
      out.stack = stack
    } else {
      const lines = stack.split('\n').slice(0, opts.maxStackLines ?? 50)
      out.stack = lines.map((l) => l.replace(/(\s+at\s+[^(]*\()(\/[^)]+)/g, '$1<path>')).join('\n')
    }
  }
  return out
}
```

- [ ] **Step 5: Implementar timed**

```typescript
// app/shared/helpers/timed.ts
import logger from '@adonisjs/core/services/logger'

export async function timed<T>(label: string, cb: () => Promise<T>, slowMs = 500): Promise<T> {
  const t0 = Date.now()
  try {
    return await cb()
  } finally {
    const dt = Date.now() - t0
    if (dt > slowMs) {
      logger.warn({ label, durationMs: dt }, 'slow.path')
    }
  }
}
```

- [ ] **Step 6: Implementar error_messages**

```typescript
// app/shared/helpers/error_messages.ts
export const errorMessages: Record<string, string> = {
  E_VALIDATION_ERROR: 'Dados inválidos. Verifique os campos.',
  E_ROW_NOT_FOUND: 'Registro não encontrado.',
  E_PERMISSION_DENIED: 'Você não tem permissão para executar esta ação.',
  E_TENANT_NOT_RESOLVED: 'Sessão sem organização ativa. Selecione uma.',
  E_TENANT_MEMBERSHIP_INACTIVE: 'Sua participação nesta organização está inativa.',
  E_IMPORT_ALREADY_EXISTS: 'Este arquivo já foi importado.',
  E_IMPORT_CONCURRENT: 'Este import já está em execução.',
  E_CHECKSUM_CONFLICT: 'Já existe importação com esse checksum.',
  E_SIOP_PARSE: 'Não foi possível ler o arquivo enviado.',
  E_PII_REVEAL_FORBIDDEN: 'Acesso a dados pessoais não autorizado.',
  E_PII_RATE_LIMIT: 'Limite de visualizações sensíveis atingido. Tente novamente em breve.',
  E_FILE_TOO_LARGE: 'Arquivo excede o tamanho máximo permitido.',
  E_CSRF_TOKEN_MISMATCH: 'Sessão expirou. Recarregue a página.',
  E_INTERNAL: 'Erro interno. Informe o código de suporte.',
}

export function mapCodeToMessage(code: string | undefined): string {
  return errorMessages[code ?? ''] ?? errorMessages.E_INTERNAL
}
```

- [ ] **Step 7: Run passing**

```bash
pnpm test --files="tests/unit/shared/helpers/sanitize_error.spec.ts" --files="tests/unit/shared/helpers/timed.spec.ts"
```

Expected: 7 tests pass.

- [ ] **Step 8: Commit**

```bash
git add app/shared/helpers/{sanitize_error,timed,error_messages}.ts tests/unit/shared/helpers/{sanitize_error,timed}.spec.ts
git commit -m "🚀 feat(shared): sanitize_error, timed, error_messages helpers"
```

---

### Task 9: TenantBaseModel + TenantModel + BaseRepository

**Files:**

- Create: `app/shared/models/tenant_model.ts`
- Create: `app/shared/models/tenant_base_model.ts`
- Create: `app/shared/repositories/base_repository.ts`

- [ ] **Step 1: Implementar TenantModel (sem soft delete)**

```typescript
// app/shared/models/tenant_model.ts
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class TenantModel extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare tenantId: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
```

- [ ] **Step 2: Implementar TenantBaseModel (com soft delete)**

```typescript
// app/shared/models/tenant_base_model.ts
import { column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import TenantModel from './tenant_model.js'

export default class TenantBaseModel extends TenantModel {
  @column.dateTime()
  declare deletedAt: DateTime | null

  async softDelete() {
    this.deletedAt = DateTime.now()
    await this.save()
  }
}
```

- [ ] **Step 3: Implementar BaseRepository**

```typescript
// app/shared/repositories/base_repository.ts
import TenantModel from '#shared/models/tenant_model'
import TenantBaseModel from '#shared/models/tenant_base_model'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'

export type Attributes<M extends typeof TenantModel> = ModelAttributes<InstanceType<M>>

export default class BaseRepository<M extends typeof TenantModel> {
  constructor(protected model: M) {}

  query(tenantId: string) {
    const q = this.model.query().where('tenant_id', tenantId)
    if (this.hasSoftDelete()) q.whereNull('deleted_at')
    return q
  }

  unscopedQuery(tenantId: string) {
    return this.model.query().where('tenant_id', tenantId)
  }

  async findAll(tenantId: string) {
    return this.query(tenantId).exec()
  }

  async paginate(tenantId: string, page = 1, perPage = 25) {
    return this.query(tenantId).paginate(page, perPage)
  }

  async findById(tenantId: string, id: string) {
    return this.query(tenantId).where('id', id).first()
  }

  async findByIdOrFail(tenantId: string, id: string) {
    return this.query(tenantId).where('id', id).firstOrFail()
  }

  async findBy(tenantId: string, key: string, value: any) {
    return this.query(tenantId).where(key, value).first()
  }

  async create(tenantId: string, payload: Partial<Attributes<M>>): Promise<InstanceType<M>> {
    const data = { ...payload, tenantId }
    return this.model.create(data as any) as unknown as InstanceType<M>
  }

  async createMany(
    tenantId: string,
    payloads: Partial<Attributes<M>>[]
  ): Promise<InstanceType<M>[]> {
    const data = payloads.map((p) => ({ ...p, tenantId }))
    return this.model.createMany(data as any) as unknown as InstanceType<M>[]
  }

  async update(
    tenantId: string,
    id: string,
    payload: Partial<Attributes<M>>
  ): Promise<InstanceType<M>> {
    const row = await this.findByIdOrFail(tenantId, id)
    ;(row as any).merge(payload)
    await (row as any).save()
    return row
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const row = await this.findByIdOrFail(tenantId, id)
    if (row instanceof TenantBaseModel) {
      await row.softDelete()
    } else {
      await (row as any).delete()
    }
  }

  async forceDelete(tenantId: string, id: string): Promise<void> {
    const row = await this.unscopedQuery(tenantId).where('id', id).firstOrFail()
    await (row as any).delete()
  }

  async restore(tenantId: string, id: string): Promise<InstanceType<M>> {
    const row = await this.unscopedQuery(tenantId).where('id', id).firstOrFail()
    if (row instanceof TenantBaseModel) {
      row.deletedAt = null
      await row.save()
    }
    return row as InstanceType<M>
  }

  async exists(tenantId: string, key: string, value: any, excludeId?: string): Promise<boolean> {
    const q = this.query(tenantId).where(key, value)
    if (excludeId) q.whereNot('id', excludeId)
    return !!(await q.first())
  }

  async count(tenantId: string): Promise<number> {
    const result = await this.query(tenantId).count('* as total')
    return Number((result[0] as any)?.$extras?.total ?? 0)
  }

  protected hasSoftDelete(): boolean {
    return this.model.prototype instanceof TenantBaseModel
  }
}
```

- [ ] **Step 4: Verificar compilação**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add app/shared/models/{tenant_model,tenant_base_model}.ts app/shared/repositories/base_repository.ts
git commit -m "🚀 feat(shared): TenantModel hierarchy + BaseRepository with tenant scope"
```

---

## Phase 2 — Migrations: extensions, enums, base tables

### Task 10: Migration de extensions e enums

**Files:**

- Create: `database/migrations/<ts>_create_extensions.ts`
- Create: `database/migrations/<ts>_create_enums.ts`

- [ ] **Step 1: Criar migration extensions**

```bash
node ace make:migration create_extensions
```

Editar o arquivo gerado:

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw(`create extension if not exists "pgcrypto";`)
    this.schema.raw(`create extension if not exists "uuid-ossp";`)
    this.schema.raw(`create extension if not exists "pg_stat_statements";`)
  }

  async down() {
    this.schema.raw(`drop extension if exists "pg_stat_statements";`)
    this.schema.raw(`drop extension if exists "uuid-ossp";`)
    this.schema.raw(`drop extension if exists "pgcrypto";`)
  }
}
```

- [ ] **Step 2: Criar migration enums**

```bash
node ace make:migration create_enums
```

Editar:

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      create type lifecycle_status as enum (
        'unknown','discovered','expedited','pending','in_payment','paid','cancelled','suspended'
      );
    `)
    this.schema.raw(`
      create type pii_status as enum (
        'none','pseudonymous','bunker_available','materialized','blocked'
      );
    `)
    this.schema.raw(`
      create type compliance_status as enum (
        'pending','approved_for_analysis','approved_for_sales','blocked','opt_out'
      );
    `)
    this.schema.raw(`
      create type debtor_type as enum ('union','state','municipality','autarchy','foundation');
    `)
    this.schema.raw(`
      create type import_status as enum ('pending','running','completed','partial','failed');
    `)
    this.schema.raw(`
      create type job_run_status as enum ('pending','running','completed','failed','skipped','cancelled');
    `)
    this.schema.raw(`
      create type job_run_origin as enum ('scheduler','http','manual_retry','system');
    `)
    this.schema.raw(`
      create type pii_action as enum (
        'attempt_reveal','reveal_denied','reveal_success','export','contact','update','delete'
      );
    `)
    this.schema.raw(
      `create type validation_status as enum ('pending','valid','invalid','warning');`
    )
    this.schema.raw(`create type member_status as enum ('active','inactive');`)
    this.schema.raw(`create type tenant_status as enum ('active','suspended','inactive');`)
    this.schema.raw(`create type user_status as enum ('active','disabled');`)
    this.schema.raw(
      `create type asset_source as enum ('siop','datajud','djen','manual','tribunal','api_private');`
    )
    this.schema.raw(`create type nature_kind as enum ('alimentar','comum','tributario','unknown');`)
    this.schema.raw(
      `create type lawful_basis_kind as enum ('legitimate_interest','consent','contract','legal_obligation');`
    )
    this.schema.raw(`create type document_kind as enum ('cpf','cnpj','passport','other');`)
    this.schema.raw(`create type person_kind as enum ('natural_person','legal_person','unknown');`)
    this.schema.raw(
      `create type export_status as enum ('pending','running','completed','failed','expired');`
    )
    this.schema.raw(
      `create type retention_manifest_status as enum ('pending','confirmed','applied','aborted');`
    )
  }

  async down() {
    const types = [
      'retention_manifest_status',
      'export_status',
      'person_kind',
      'document_kind',
      'lawful_basis_kind',
      'nature_kind',
      'asset_source',
      'user_status',
      'tenant_status',
      'member_status',
      'validation_status',
      'pii_action',
      'job_run_origin',
      'job_run_status',
      'import_status',
      'debtor_type',
      'compliance_status',
      'pii_status',
      'lifecycle_status',
    ]
    for (const t of types) this.schema.raw(`drop type if exists ${t};`)
  }
}
```

- [ ] **Step 3: Rodar migrations**

```bash
node ace migration:run
```

Expected: 2 migrations rodam OK.

- [ ] **Step 4: Verificar no banco**

```bash
docker compose exec postgres psql -U juridicai -d juridicai_dev -c "\dT"
```

Expected: lista mostra todos os enums criados.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/
git commit -m "🗃️ refactor(db): create extensions and native enums for domain"
```

---

### Task 11: Migration `tenants`

**Files:**

- Create: `database/migrations/<ts>_create_tenants.ts`

- [ ] **Step 1: Gerar migration**

```bash
node ace make:migration create_tenants
```

- [ ] **Step 2: Conteúdo**

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'tenants'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      t.string('name').notNullable()
      t.string('slug').notNullable().unique()
      t.string('document').nullable()
      t.specificType('status', 'tenant_status').notNullable().defaultTo('active')
      t.string('plan').nullable()
      t.integer('rbac_version').notNullable().defaultTo(1)
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 3: Rodar e verificar**

```bash
node ace migration:run
docker compose exec postgres psql -U juridicai -d juridicai_dev -c "\d tenants"
```

Expected: tabela criada com colunas certas.

- [ ] **Step 4: Commit**

```bash
git add database/migrations/
git commit -m "🗃️ refactor(db): create tenants table"
```

---

### Task 12: Refatorar migration `users` (do starter) e adicionar `auth_tokens`, `tenant_memberships`

**Files:**

- Modify: `database/migrations/1761885935168_create_users_table.ts`
- Create: `database/migrations/<ts>_create_auth_tokens.ts`
- Create: `database/migrations/<ts>_create_tenant_memberships.ts`

- [ ] **Step 1: Reescrever migration users**

Substituir o conteúdo:

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      t.string('name').notNullable()
      t.string('email').notNullable().unique()
      t.string('password_hash').notNullable()
      t.specificType('status', 'user_status').notNullable().defaultTo('active')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 2: Migration auth_tokens (Adonis Auth padrão)**

```bash
node ace make:migration create_auth_tokens
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'auth_access_tokens'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.increments('id').notNullable()
      t.uuid('tokenable_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      t.string('type').notNullable()
      t.string('name').nullable()
      t.string('hash').notNullable()
      t.text('abilities').notNullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('last_used_at', { useTz: true }).nullable()
      t.timestamp('expires_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 3: Migration tenant_memberships**

```bash
node ace make:migration create_tenant_memberships
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'tenant_memberships'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      t.specificType('status', 'member_status').notNullable().defaultTo('active')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.unique(['tenant_id', 'user_id'])
      t.index(['user_id', 'status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 4: Rodar e verificar**

```bash
node ace migration:run
docker compose exec postgres psql -U juridicai -d juridicai_dev -c "\d users; \d auth_access_tokens; \d tenant_memberships"
```

- [ ] **Step 5: Commit**

```bash
git add database/migrations/
git commit -m "🗃️ refactor(db): users multi-tenant + auth_tokens + tenant_memberships"
```

---

### Task 13: Models Lucid `Tenant`, `User`, `TenantMembership`

**Files:**

- Create: `app/models/tenant.ts`
- Modify: `app/models/user.ts` (já existe do starter)
- Create: `app/models/tenant_membership.ts`

- [ ] **Step 1: Tenant model**

```bash
node ace make:model Tenant
```

```typescript
// app/models/tenant.ts
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import TenantMembership from './tenant_membership.js'

export default class Tenant extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column() declare name: string
  @column() declare slug: string
  @column() declare document: string | null
  @column() declare status: 'active' | 'suspended' | 'inactive'
  @column() declare plan: string | null
  @column() declare rbacVersion: number

  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime

  @hasMany(() => TenantMembership) declare memberships: HasMany<typeof TenantMembership>
}
```

- [ ] **Step 2: User model — ajustar do starter**

Editar `app/models/user.ts`:

```typescript
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import TenantMembership from './tenant_membership.js'

const AuthFinder = withAuthFinder(() => hash.use('argon'), {
  uids: ['email'],
  passwordColumnName: 'passwordHash',
})

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true }) declare id: string
  @column() declare name: string
  @column() declare email: string
  @column({ serializeAs: null }) declare passwordHash: string
  @column() declare status: 'active' | 'disabled'

  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime

  @hasMany(() => TenantMembership) declare memberships: HasMany<typeof TenantMembership>
}
```

- [ ] **Step 3: TenantMembership model**

```bash
node ace make:model TenantMembership
```

```typescript
// app/models/tenant_membership.ts
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import Tenant from './tenant.js'
import User from './user.js'

export default class TenantMembership extends BaseModel {
  @column({ isPrimary: true }) declare id: string
  @column() declare tenantId: string
  @column() declare userId: string
  @column() declare status: 'active' | 'inactive'

  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime

  @belongsTo(() => Tenant) declare tenant: BelongsTo<typeof Tenant>
  @belongsTo(() => User) declare user: BelongsTo<typeof User>
}
```

- [ ] **Step 4: Verificar typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add app/models/
git commit -m "🚀 feat(models): Tenant, User (refatorado), TenantMembership"
```

---

## Phase 3 — RBAC dinâmico

### Task 14: Migrations RBAC (`permissions`, `roles`, `role_permissions`, `user_roles`)

**Files:**

- Create: 4 migrations

- [ ] **Step 1: Gerar migrations**

```bash
node ace make:migration create_permissions
node ace make:migration create_roles
node ace make:migration create_role_permissions
node ace make:migration create_user_roles
```

- [ ] **Step 2: Conteúdo `create_permissions`**

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'permissions'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      t.string('name').notNullable()
      t.string('slug').notNullable().unique()
      t.text('description').nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 3: `create_roles`**

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'roles'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      t.string('name').notNullable()
      t.string('slug').notNullable().unique()
      t.text('description').nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 4: `create_role_permissions`**

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'role_permissions'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE')
      t.uuid('permission_id')
        .notNullable()
        .references('id')
        .inTable('permissions')
        .onDelete('CASCADE')
      t.primary(['role_id', 'permission_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 5: `create_user_roles`**

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_roles'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      t.uuid('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.unique(['tenant_id', 'user_id', 'role_id'])
      t.index(['user_id', 'tenant_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 6: Rodar e verificar**

```bash
node ace migration:run
```

- [ ] **Step 7: Commit**

```bash
git add database/migrations/
git commit -m "🗃️ refactor(db): RBAC tables (permissions, roles, role_permissions, user_roles)"
```

---

### Task 15: Seeders RBAC (permissions e roles)

**Files:**

- Create: `database/seeders/permissions_seeder.ts`
- Create: `database/seeders/roles_seeder.ts`
- Create: `database/seeders/index_seeder.ts`

- [ ] **Step 1: Gerar seeders**

```bash
node ace make:seeder PermissionsSeeder
node ace make:seeder RolesSeeder
node ace make:seeder IndexSeeder
```

- [ ] **Step 2: Conteúdo `permissions_seeder.ts`**

```typescript
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

export default class extends BaseSeeder {
  static permissions = [
    'precatorios.read',
    'precatorios.list',
    'imports.read',
    'imports.create',
    'imports.reprocess',
    'imports.download_source',
    'assets.audit',
    'assets.score',
    'assets.export',
    'pii.reveal_masked',
    'pii.reveal_full',
    'pii.export',
    'pii.opt_out_manage',
    'users.invite',
    'users.manage_roles',
    'tenants.settings',
    'tenants.manage',
    'admin.jobs.read',
    'admin.jobs.retry',
    'exports.create',
    'exports.download',
  ]

  async run() {
    for (const slug of (this.constructor as any).permissions) {
      await db
        .from('permissions')
        .insert({
          name: slug,
          slug,
          description: `Permission: ${slug}`,
        })
        .onConflict('slug')
        .ignore()
    }
  }
}
```

- [ ] **Step 3: Conteúdo `roles_seeder.ts`**

```typescript
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

const ROLES: Record<string, string[]> = {
  radar_reader: ['precatorios.read', 'precatorios.list', 'imports.read'],
  legal_reviewer: [
    'precatorios.read',
    'precatorios.list',
    'imports.read',
    'imports.create',
    'imports.reprocess',
    'imports.download_source',
    'assets.audit',
    'assets.score',
  ],
  sales_authorized: ['precatorios.read', 'precatorios.list', 'pii.reveal_masked'],
  privacy_admin: [
    'pii.reveal_full',
    'pii.export',
    'pii.opt_out_manage',
    'users.invite',
    'tenants.settings',
    'admin.jobs.read',
    'admin.jobs.retry',
    'exports.create',
    'exports.download',
  ],
  tenant_admin: [
    'precatorios.read',
    'precatorios.list',
    'imports.read',
    'imports.create',
    'imports.reprocess',
    'imports.download_source',
    'assets.audit',
    'assets.score',
    'assets.export',
    'users.invite',
    'users.manage_roles',
    'tenants.settings',
    'tenants.manage',
    'admin.jobs.read',
    'admin.jobs.retry',
    'exports.create',
    'exports.download',
  ],
}

export default class extends BaseSeeder {
  async run() {
    for (const [slug, perms] of Object.entries(ROLES)) {
      const [role] = await db
        .from('roles')
        .insert({
          name: slug.replace(/_/g, ' '),
          slug,
          description: `Role: ${slug}`,
        })
        .onConflict('slug')
        .merge(['updated_at'])
        .returning(['id'])

      const roleId = role.id
      const permRows = await db.from('permissions').whereIn('slug', perms).select('id')

      // limpa antes de re-inserir (idempotente)
      await db.from('role_permissions').where('role_id', roleId).delete()
      for (const pr of permRows) {
        await db.from('role_permissions').insert({ role_id: roleId, permission_id: pr.id })
      }
    }
  }
}
```

- [ ] **Step 4: `index_seeder.ts` orquestra**

```typescript
import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    await this.runner.runFile('./database/seeders/permissions_seeder')
    await this.runner.runFile('./database/seeders/roles_seeder')
  }
}
```

- [ ] **Step 5: Rodar seeders**

```bash
node ace db:seed --files="./database/seeders/index_seeder.ts"
```

Expected: 21 permissions + 5 roles inseridos.

- [ ] **Step 6: Verificar**

```bash
docker compose exec postgres psql -U juridicai -d juridicai_dev -c "select count(*) from permissions; select count(*) from roles; select count(*) from role_permissions;"
```

Expected: 21, 5, ~30+ rows.

- [ ] **Step 7: Commit**

```bash
git add database/seeders/
git commit -m "🌱 seed: RBAC permissions and roles seed"
```

---

### Task 16: PermissionCacheService

**Files:**

- Create: `app/shared/services/permission_cache_service.ts`
- Create: `tests/integration/shared/permission_cache_service.spec.ts`

- [ ] **Step 1: Test**

```typescript
// tests/integration/shared/permission_cache_service.spec.ts
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import permissionCacheService from '#shared/services/permission_cache_service'

test.group('PermissionCacheService', (group) => {
  let tenantId: string
  let userId: string

  group.each.setup(async () => {
    await redis.flushdb()
    const [t] = await db
      .from('tenants')
      .insert({
        name: 'T',
        slug: `t-${Date.now()}`,
        status: 'active',
        rbac_version: 1,
      })
      .returning('id')
    tenantId = t.id
    const [u] = await db
      .from('users')
      .insert({
        name: 'U',
        email: `u-${Date.now()}@x.com`,
        password_hash: 'x',
        status: 'active',
      })
      .returning('id')
    userId = u.id
    const role = await db.from('roles').where('slug', 'radar_reader').first()
    await db.from('user_roles').insert({ user_id: userId, tenant_id: tenantId, role_id: role.id })
  })

  test('userHas returns true for granted permission', async ({ assert }) => {
    const has = await permissionCacheService.userHas(userId, tenantId, 'precatorios.read')
    assert.isTrue(has)
  })

  test('userHas returns false for missing permission', async ({ assert }) => {
    const has = await permissionCacheService.userHas(userId, tenantId, 'pii.reveal_full')
    assert.isFalse(has)
  })

  test('cache invalidates when rbac_version bumps', async ({ assert }) => {
    await permissionCacheService.userHas(userId, tenantId, 'precatorios.read') // popula cache
    await db.from('tenants').where('id', tenantId).update({ rbac_version: 2 })
    const role = await db.from('roles').where('slug', 'privacy_admin').first()
    await db.from('user_roles').insert({ user_id: userId, tenant_id: tenantId, role_id: role.id })
    const has = await permissionCacheService.userHas(userId, tenantId, 'pii.reveal_full')
    assert.isTrue(has)
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm test --files="tests/integration/shared/permission_cache_service.spec.ts"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implementar service**

```typescript
// app/shared/services/permission_cache_service.ts
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'

class PermissionCacheService {
  private prefix = 'radar:perm'
  private ttlSeconds = 60

  async userHas(userId: string, tenantId: string, permissionSlug: string): Promise<boolean> {
    const perms = await this.loadPermissions(userId, tenantId)
    return perms.includes(permissionSlug)
  }

  async loadPermissions(userId: string, tenantId: string): Promise<string[]> {
    const tenant = await db.from('tenants').where('id', tenantId).select('rbac_version').first()
    const rbacVersion = tenant?.rbac_version ?? 1
    const key = `${this.prefix}:${tenantId}:${userId}:${rbacVersion}`

    const cached = await redis.get(key)
    if (cached) return JSON.parse(cached)

    const rows = await db
      .from('permissions as p')
      .join('role_permissions as rp', 'rp.permission_id', 'p.id')
      .join('user_roles as ur', 'ur.role_id', 'rp.role_id')
      .where('ur.user_id', userId)
      .andWhere('ur.tenant_id', tenantId)
      .select('p.slug')

    const slugs = rows.map((r) => r.slug)
    await redis.setex(key, this.ttlSeconds, JSON.stringify(slugs))
    return slugs
  }

  async invalidate(tenantId: string): Promise<void> {
    await db.from('tenants').where('id', tenantId).increment('rbac_version', 1)
    // os keys antigos serão invalidados pela mudança da versão; lazy purge via TTL
  }
}

export default new PermissionCacheService()
```

- [ ] **Step 4: Run passing**

```bash
pnpm test --files="tests/integration/shared/permission_cache_service.spec.ts"
```

Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add app/shared/services/permission_cache_service.ts tests/integration/shared/permission_cache_service.spec.ts
git commit -m "🚀 feat(shared): PermissionCacheService with rbac_version invalidation"
```

---

### Task 17: TenantMiddleware + RequestIdMiddleware + PermissionMiddleware

**Files:**

- Create: `app/middleware/request_id_middleware.ts`
- Create: `app/middleware/tenant_middleware.ts`
- Create: `app/middleware/permission_middleware.ts`
- Modify: `start/kernel.ts`

- [ ] **Step 1: RequestIdMiddleware**

```bash
node ace make:middleware request_id
```

Conteúdo:

```typescript
// app/middleware/request_id_middleware.ts
import { randomUUID } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

const REQUEST_ID_RE = /^[a-zA-Z0-9._:-]+$/
const MAX_LEN = 128

export default class RequestIdMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const incoming = ctx.request.header('x-request-id')
    let id: string
    if (incoming && incoming.length <= MAX_LEN && REQUEST_ID_RE.test(incoming)) {
      id = incoming
    } else {
      id = randomUUID()
    }
    ctx.requestId = id
    ctx.response.header('x-request-id', id)
    return next()
  }
}

declare module '@adonisjs/core/http' {
  interface HttpContext {
    requestId: string
  }
}
```

- [ ] **Step 2: TenantMiddleware**

```bash
node ace make:middleware tenant
```

```typescript
// app/middleware/tenant_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import db from '@adonisjs/lucid/services/db'
import TenantContext from '#shared/helpers/tenant_context'

export default class TenantMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.user
    if (!user) {
      return ctx.response.unauthorized({ error: { code: 'E_UNAUTHENTICATED' } })
    }

    const activeTenantId = ctx.session.get('active_tenant_id') as string | undefined
    if (!activeTenantId) {
      return ctx.response.redirect('/tenants/select')
    }

    const membership = await db
      .from('tenant_memberships')
      .where('user_id', user.id)
      .andWhere('tenant_id', activeTenantId)
      .andWhere('status', 'active')
      .first()

    if (!membership) {
      ctx.session.forget('active_tenant_id')
      return ctx.response.unauthorized({ error: { code: 'E_TENANT_MEMBERSHIP_INACTIVE' } })
    }

    ctx.tenant = { id: activeTenantId, membership }
    return TenantContext.run(activeTenantId, async () => next())
  }
}

declare module '@adonisjs/core/http' {
  interface HttpContext {
    tenant: { id: string; membership: any }
  }
}
```

- [ ] **Step 3: PermissionMiddleware**

```bash
node ace make:middleware permission
```

```typescript
// app/middleware/permission_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import permissionCacheService from '#shared/services/permission_cache_service'

export default class PermissionMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options?: { permission: string }) {
    if (!options?.permission) {
      return next() // sem permission configurada, deixa passar
    }
    const ok = await permissionCacheService.userHas(
      ctx.auth.user!.id,
      ctx.tenant.id,
      options.permission
    )
    if (!ok) {
      return ctx.response.forbidden({ error: { code: 'E_PERMISSION_DENIED' } })
    }
    return next()
  }
}
```

- [ ] **Step 4: Atualizar start/kernel.ts**

Adicionar ao `server.use([...])` antes do `inertia_middleware`:

```typescript
() => import('#middleware/request_id_middleware'),
```

E ao `router.named({...})`:

```typescript
tenant: () => import('#middleware/tenant_middleware'),
  permission
:
() => import('#middleware/permission_middleware'),
```

- [ ] **Step 5: Verificar typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add app/middleware/ start/kernel.ts
git commit -m "🚀 feat(middleware): request_id, tenant, permission middleware"
```

---

## Phase 4 — Source records + SIOP imports

### Task 18: Migration `source_records`

**Files:**

- Create: `database/migrations/<ts>_create_source_records.ts`

- [ ] **Step 1: Migration**

```bash
node ace make:migration create_source_records
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'source_records'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      t.specificType('source', 'asset_source').notNullable()
      t.text('source_url').nullable()
      t.text('source_file_path').nullable()
      t.string('source_checksum').nullable()
      t.text('original_filename').nullable()
      t.string('mime_type').nullable()
      t.bigInteger('file_size_bytes').nullable()
      t.timestamp('collected_at', { useTz: true }).notNullable()
      t.jsonb('raw_data').nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.index(['tenant_id', 'source', 'collected_at'])
    })

    // Unique parcial — checksum não-nulo
    this.schema.raw(`
      create unique index source_records_tenant_source_checksum_uq
      on source_records (tenant_id, source, source_checksum)
      where source_checksum is not null;
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 2: Rodar e verificar**

```bash
node ace migration:run
docker compose exec postgres psql -U juridicai -d juridicai_dev -c "\d source_records"
```

- [ ] **Step 3: Commit**

```bash
git add database/migrations/
git commit -m "🗃️ refactor(db): source_records table for procedência"
```

---

### Task 19: Migration `siop_imports` + `siop_staging_rows`

**Files:**

- Create: 2 migrations

- [ ] **Step 1: Migrations**

```bash
node ace make:migration create_siop_imports
node ace make:migration create_siop_staging_rows
```

- [ ] **Step 2: `siop_imports`**

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'siop_imports'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      t.integer('exercise_year').notNullable()
      t.uuid('source_record_id')
        .notNullable()
        .references('id')
        .inTable('source_records')
        .onDelete('RESTRICT')
      t.specificType('source', 'asset_source').notNullable().defaultTo('siop')
      t.specificType('status', 'import_status').notNullable().defaultTo('pending')
      t.timestamp('started_at', { useTz: true }).nullable()
      t.timestamp('finished_at', { useTz: true }).nullable()
      t.integer('total_rows').notNullable().defaultTo(0)
      t.integer('inserted').notNullable().defaultTo(0)
      t.integer('updated').notNullable().defaultTo(0)
      t.integer('skipped').notNullable().defaultTo(0)
      t.integer('errors').notNullable().defaultTo(0)
      t.jsonb('raw_metadata').nullable()
      t.uuid('uploaded_by_user_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('deleted_at', { useTz: true }).nullable()
      t.unique(['tenant_id', 'source', 'exercise_year', 'source_record_id'])
      t.index(['tenant_id', 'exercise_year', 'status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 3: `siop_staging_rows`**

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'siop_staging_rows'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      t.uuid('import_id').notNullable().references('id').inTable('siop_imports').onDelete('CASCADE')
      t.jsonb('raw_data').notNullable()
      t.string('normalized_cnj').nullable()
      t.string('normalized_debtor_key').nullable()
      t.decimal('normalized_value', 18, 2).nullable()
      t.integer('normalized_year').nullable()
      t.specificType('validation_status', 'validation_status').notNullable().defaultTo('pending')
      t.jsonb('errors').nullable()
      t.timestamp('processed_at', { useTz: true }).nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.index(['import_id', 'validation_status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 4: Rodar e verificar**

```bash
node ace migration:run
docker compose exec postgres psql -U juridicai -d juridicai_dev -c "\d siop_imports; \d siop_staging_rows"
```

- [ ] **Step 5: Commit**

```bash
git add database/migrations/
git commit -m "🗃️ refactor(db): siop_imports and siop_staging_rows tables"
```

---

## Phase 5 — Domínio: debtors, precatorio_assets, asset_events, asset_scores

### Task 20: Migrations debtors + precatorio_assets

**Files:**

- Create: 2 migrations

- [ ] **Step 1: `create_debtors`**

```bash
node ace make:migration create_debtors
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'debtors'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      t.text('name').notNullable()
      t.text('normalized_name').notNullable()
      t.string('normalized_key').notNullable()
      t.specificType('debtor_type', 'debtor_type').notNullable()
      t.string('cnpj').nullable()
      t.specificType('state_code', 'char(2)').nullable()
      t.string('payment_regime').nullable()
      t.decimal('rcl_estimate', 18, 2).nullable()
      t.decimal('debt_stock_estimate', 18, 2).nullable()
      t.smallint('payment_reliability_score').nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('deleted_at', { useTz: true }).nullable()
    })

    this.schema.raw(`
      create unique index debtors_tenant_type_cnpj_uq
      on debtors (tenant_id, debtor_type, cnpj)
      where cnpj is not null;
    `)
    this.schema.raw(`
      create unique index debtors_tenant_type_state_key_uq
      on debtors (tenant_id, debtor_type, state_code, normalized_key)
      where cnpj is null;
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 2: `create_precatorio_assets`**

```bash
node ace make:migration create_precatorio_assets
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'precatorio_assets'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      t.uuid('source_record_id')
        .nullable()
        .references('id')
        .inTable('source_records')
        .onDelete('SET NULL')
      t.specificType('source', 'asset_source').notNullable()
      t.string('external_id').nullable()
      t.string('cnj_number').nullable()
      t.string('origin_process_number').nullable()
      t.uuid('debtor_id').nullable().references('id').inTable('debtors').onDelete('SET NULL')
      t.string('asset_number').nullable()
      t.integer('exercise_year').nullable()
      t.integer('budget_year').nullable()
      t.specificType('nature', 'nature_kind').notNullable().defaultTo('unknown')
      t.decimal('face_value', 18, 2).nullable()
      t.decimal('estimated_updated_value', 18, 2).nullable()
      t.date('base_date').nullable()
      t.integer('queue_position').nullable()
      t.specificType('lifecycle_status', 'lifecycle_status').notNullable().defaultTo('unknown')
      t.specificType('pii_status', 'pii_status').notNullable().defaultTo('none')
      t.specificType('compliance_status', 'compliance_status').notNullable().defaultTo('pending')
      t.smallint('current_score').nullable()
      t.uuid('current_score_id').nullable() // FK adicionada depois
      t.jsonb('raw_data').nullable()
      t.string('row_fingerprint').nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('deleted_at', { useTz: true }).nullable()

      t.index(['tenant_id', 'lifecycle_status', 'created_at'])
      t.index(['tenant_id', 'debtor_id', 'lifecycle_status'])
      t.index(['tenant_id', 'exercise_year', 'lifecycle_status'])
    })

    this.schema.raw(`
      create unique index precatorio_assets_tenant_source_external_uq
      on precatorio_assets (tenant_id, source, external_id)
      where external_id is not null;
    `)
    this.schema.raw(`
      create unique index precatorio_assets_tenant_cnj_uq
      on precatorio_assets (tenant_id, cnj_number)
      where cnj_number is not null;
    `)
    this.schema.raw(`
      create index precatorio_assets_tenant_facevalue_expedited_idx
      on precatorio_assets (tenant_id, face_value desc)
      where lifecycle_status = 'expedited';
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 3: Rodar e verificar**

```bash
node ace migration:run
docker compose exec postgres psql -U juridicai -d juridicai_dev -c "\d debtors; \d precatorio_assets"
```

- [ ] **Step 4: Commit**

```bash
git add database/migrations/
git commit -m "🗃️ refactor(db): debtors and precatorio_assets with partial unique indexes"
```

---

### Task 21: Migrations asset_events + asset_scores + FK ciclo

**Files:**

- Create: 3 migrations

- [ ] **Step 1: `create_asset_events`**

```bash
node ace make:migration create_asset_events
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'asset_events'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      t.uuid('asset_id')
        .notNullable()
        .references('id')
        .inTable('precatorio_assets')
        .onDelete('CASCADE')
      t.string('event_type').notNullable()
      t.timestamp('event_date', { useTz: true }).notNullable().defaultTo(this.now())
      t.string('source').nullable()
      t.jsonb('payload').nullable()
      t.string('idempotency_key').notNullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.unique(['tenant_id', 'asset_id', 'event_type', 'idempotency_key'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 2: `create_asset_scores`**

```bash
node ace make:migration create_asset_scores
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'asset_scores'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      t.uuid('asset_id')
        .notNullable()
        .references('id')
        .inTable('precatorio_assets')
        .onDelete('CASCADE')
      t.string('score_version').notNullable()
      t.smallint('data_quality_score').nullable()
      t.smallint('maturity_score').nullable()
      t.smallint('liquidity_score').nullable()
      t.smallint('legal_signal_score').nullable()
      t.smallint('economic_score').nullable()
      t.smallint('risk_score').nullable()
      t.smallint('final_score').nullable()
      t.jsonb('explanation').nullable()
      t.timestamp('computed_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.index(['tenant_id', 'asset_id', 'computed_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 3: Migration ALTER pra adicionar FK ciclo**

```bash
node ace make:migration add_fk_precatorio_assets_current_score
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      alter table precatorio_assets
      add constraint fk_precatorio_assets_current_score
      foreign key (current_score_id)
      references asset_scores(id)
      on delete set null
      deferrable initially deferred;
    `)
  }

  async down() {
    this.schema.raw(`
      alter table precatorio_assets
      drop constraint if exists fk_precatorio_assets_current_score;
    `)
  }
}
```

- [ ] **Step 4: Rodar**

```bash
node ace migration:run
```

- [ ] **Step 5: Commit**

```bash
git add database/migrations/
git commit -m "🗃️ refactor(db): asset_events, asset_scores, deferred FK for current_score"
```

---

## Phase 6 — Schemas preparados (DataJud/DJEN futuros)

### Task 22: Migrations judicial_processes + publications + publication_events

**Files:**

- Create: 3 migrations

- [ ] **Step 1: `create_judicial_processes`**

```bash
node ace make:migration create_judicial_processes
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'judicial_processes'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      t.string('cnj_number').nullable()
      t.string('court').nullable()
      t.string('justice_branch').nullable()
      t.string('class_code').nullable()
      t.string('class_name').nullable()
      t.text('subject').nullable()
      t.date('filing_date').nullable()
      t.string('secrecy_level').nullable()
      t.uuid('source_record_id')
        .nullable()
        .references('id')
        .inTable('source_records')
        .onDelete('SET NULL')
      t.timestamp('last_movement_at', { useTz: true }).nullable()
      t.jsonb('raw_data').nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('deleted_at', { useTz: true }).nullable()
    })

    this.schema.raw(`
      create unique index judicial_processes_tenant_cnj_uq
      on judicial_processes (tenant_id, cnj_number)
      where cnj_number is not null;
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 2: `create_publications`**

```bash
node ace make:migration create_publications
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'publications'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      t.uuid('process_id')
        .nullable()
        .references('id')
        .inTable('judicial_processes')
        .onDelete('SET NULL')
      t.uuid('source_record_id')
        .nullable()
        .references('id')
        .inTable('source_records')
        .onDelete('SET NULL')
      t.specificType('source', 'asset_source').notNullable()
      t.timestamp('publication_date', { useTz: true }).notNullable()
      t.string('text_hash').nullable()
      t.text('text_content').nullable()
      t.string('extracted_event_type').nullable()
      t.text('summary').nullable()
      t.jsonb('raw_data').nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.raw(`
      create unique index publications_tenant_source_hash_date_uq
      on publications (tenant_id, source, text_hash, publication_date)
      where text_hash is not null;
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 3: `create_publication_events`**

```bash
node ace make:migration create_publication_events
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'publication_events'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      t.uuid('publication_id')
        .notNullable()
        .references('id')
        .inTable('publications')
        .onDelete('CASCADE')
      t.string('event_type').notNullable()
      t.jsonb('payload').nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 4: Rodar e commit**

```bash
node ace migration:run
git add database/migrations/
git commit -m "🗃️ refactor(db): prepared schemas for DataJud/DJEN (Spec 2/3)"
```

---

## Phase 7 — PII Bunker

### Task 23: Schema `pii` + tabelas

**Files:**

- Create: 4 migrations

- [ ] **Step 1: `create_pii_schema`**

```bash
node ace make:migration create_pii_schema
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw(`create schema if not exists pii;`)
  }

  async down() {
    this.schema.raw(`drop schema if exists pii cascade;`)
  }
}
```

- [ ] **Step 2: `create_pii_beneficiaries`**

```bash
node ace make:migration create_pii_beneficiaries
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      create table pii.beneficiaries (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references public.tenants(id) on delete cascade,
        beneficiary_hash text not null,
        name_encrypted bytea,
        document_encrypted bytea,
        document_type document_kind,
        document_last4 char(4),
        person_type person_kind,
        source asset_source not null,
        source_url text,
        source_collected_at timestamptz not null,
        source_checksum text,
        lawful_basis lawful_basis_kind not null,
        purpose text not null,
        lia_id uuid,
        opt_out boolean not null default false,
        retention_until timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (tenant_id, beneficiary_hash)
      );
      create index on pii.beneficiaries (tenant_id, beneficiary_hash);
    `)
  }

  async down() {
    this.schema.raw(`drop table if exists pii.beneficiaries;`)
  }
}
```

- [ ] **Step 3: `create_pii_asset_beneficiaries`**

```bash
node ace make:migration create_pii_asset_beneficiaries
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      create table pii.asset_beneficiaries (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references public.tenants(id) on delete cascade,
        asset_id uuid not null,
        beneficiary_id uuid not null references pii.beneficiaries(id) on delete cascade,
        role text,
        amount numeric(18,2),
        amount_ratio numeric(10,6),
        created_at timestamptz not null default now(),
        unique (tenant_id, asset_id, beneficiary_id, role)
      );
      create index on pii.asset_beneficiaries (tenant_id, asset_id);
    `)
  }

  async down() {
    this.schema.raw(`drop table if exists pii.asset_beneficiaries;`)
  }
}
```

- [ ] **Step 4: `create_pii_access_logs`**

```bash
node ace make:migration create_pii_access_logs
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      create table pii.access_logs (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null,
        actor_user_id uuid not null,
        beneficiary_id uuid,
        asset_id uuid,
        action pii_action not null,
        purpose text not null,
        lawful_basis text,
        justification text,
        ip_address inet,
        user_agent text,
        request_id uuid,
        created_at timestamptz not null default now()
      );
      create index on pii.access_logs (tenant_id, actor_user_id, created_at desc);
    `)
  }

  async down() {
    this.schema.raw(`drop table if exists pii.access_logs;`)
  }
}
```

- [ ] **Step 5: Rodar e commit**

```bash
node ace migration:run
git add database/migrations/
git commit -m "🗃️ refactor(db): pii.* schema with beneficiaries, asset_beneficiaries, access_logs"
```

---

### Task 24: Função `pii.reveal_beneficiary` (SECURITY DEFINER)

**Files:**

- Create: `database/migrations/<ts>_create_pii_reveal_function.ts`

- [ ] **Step 1: Migration**

```bash
node ace make:migration create_pii_reveal_function
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      create or replace function pii.reveal_beneficiary(
        p_beneficiary_id uuid,
        p_purpose text,
        p_justification text,
        p_actor_user_id uuid,
        p_asset_id uuid default null,
        p_ip_address inet default null,
        p_user_agent text default null,
        p_request_id uuid default null
      ) returns table(name text, document text, document_type text)
      language plpgsql
      security definer
      set search_path = pii, public, pg_temp
      as $$
      declare
        v_tenant_id uuid;
        v_beneficiary pii.beneficiaries;
        v_has_perm boolean;
      begin
        v_tenant_id := current_setting('app.current_tenant_id', true)::uuid;
        if v_tenant_id is null then
          raise exception 'E_TENANT_NOT_RESOLVED';
        end if;

        -- registra tentativa antes de qualquer validação
        insert into pii.access_logs(tenant_id, actor_user_id, beneficiary_id, asset_id,
          action, purpose, justification, ip_address, user_agent, request_id)
        values (v_tenant_id, p_actor_user_id, p_beneficiary_id, p_asset_id,
          'attempt_reveal', p_purpose, p_justification, p_ip_address, p_user_agent, p_request_id);

        -- valida actor + membership ativa
        if not exists (
          select 1 from public.tenant_memberships
          where user_id = p_actor_user_id
            and tenant_id = v_tenant_id
            and status = 'active'
        ) then
          insert into pii.access_logs(tenant_id, actor_user_id, beneficiary_id, asset_id,
            action, purpose, justification, ip_address, user_agent, request_id)
          values (v_tenant_id, p_actor_user_id, p_beneficiary_id, p_asset_id,
            'reveal_denied', p_purpose, p_justification, p_ip_address, p_user_agent, p_request_id);
          raise exception 'E_TENANT_MEMBERSHIP_INACTIVE';
        end if;

        -- valida permission pii.reveal_*
        select exists (
          select 1 from public.user_roles ur
          join public.role_permissions rp on rp.role_id = ur.role_id
          join public.permissions p on p.id = rp.permission_id
          where ur.user_id = p_actor_user_id
            and ur.tenant_id = v_tenant_id
            and p.slug in ('pii.reveal_full', 'pii.reveal_masked')
        ) into v_has_perm;

        if not v_has_perm then
          insert into pii.access_logs(tenant_id, actor_user_id, beneficiary_id, asset_id,
            action, purpose, justification, ip_address, user_agent, request_id)
          values (v_tenant_id, p_actor_user_id, p_beneficiary_id, p_asset_id,
            'reveal_denied', p_purpose, p_justification, p_ip_address, p_user_agent, p_request_id);
          raise exception 'E_PII_REVEAL_FORBIDDEN';
        end if;

        -- carrega beneficiário com tenant match
        select * into v_beneficiary
        from pii.beneficiaries
        where id = p_beneficiary_id and tenant_id = v_tenant_id;

        if v_beneficiary is null then
          raise exception 'E_ROW_NOT_FOUND';
        end if;

        if v_beneficiary.opt_out then
          insert into pii.access_logs(tenant_id, actor_user_id, beneficiary_id, asset_id,
            action, purpose, justification, ip_address, user_agent, request_id)
          values (v_tenant_id, p_actor_user_id, p_beneficiary_id, p_asset_id,
            'reveal_denied', p_purpose, p_justification, p_ip_address, p_user_agent, p_request_id);
          raise exception 'E_PII_REVEAL_FORBIDDEN';
        end if;

        if p_purpose is null or length(trim(p_purpose)) = 0 then
          raise exception 'E_VALIDATION_ERROR purpose required';
        end if;

        if p_asset_id is not null and not exists (
          select 1 from public.precatorio_assets
          where id = p_asset_id and tenant_id = v_tenant_id
        ) then
          raise exception 'E_ROW_NOT_FOUND asset';
        end if;

        -- registra acesso bem sucedido
        insert into pii.access_logs(tenant_id, actor_user_id, beneficiary_id, asset_id,
          action, purpose, justification, lawful_basis, ip_address, user_agent, request_id)
        values (v_tenant_id, p_actor_user_id, p_beneficiary_id, p_asset_id,
          'reveal_success', p_purpose, p_justification, v_beneficiary.lawful_basis::text,
          p_ip_address, p_user_agent, p_request_id);

        return query select
          pgp_sym_decrypt(v_beneficiary.name_encrypted, current_setting('app.pii_encryption_key'))::text,
          pgp_sym_decrypt(v_beneficiary.document_encrypted, current_setting('app.pii_encryption_key'))::text,
          v_beneficiary.document_type::text;
      end;
      $$;
    `)
  }

  async down() {
    this.schema.raw(
      `drop function if exists pii.reveal_beneficiary(uuid, text, text, uuid, uuid, inet, text, uuid);`
    )
  }
}
```

- [ ] **Step 2: Rodar**

```bash
node ace migration:run
```

- [ ] **Step 3: Verificar função existe**

```bash
docker compose exec postgres psql -U juridicai -d juridicai_dev -c "\df pii.reveal_beneficiary"
```

- [ ] **Step 4: Commit**

```bash
git add database/migrations/
git commit -m "🔒 security(db): pii.reveal_beneficiary SECURITY DEFINER with attempt_reveal logging"
```

---

### Task 25: RLS policies pii.\* + audit append-only RULES

**Files:**

- Create: `database/migrations/<ts>_create_pii_rls_policies.ts`

- [ ] **Step 1: Migration**

```bash
node ace make:migration create_pii_rls_policies
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      alter table pii.beneficiaries enable row level security;
      alter table pii.asset_beneficiaries enable row level security;
      alter table pii.access_logs enable row level security;

      create policy tenant_isolation on pii.beneficiaries
        using (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
      create policy tenant_isolation on pii.asset_beneficiaries
        using (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
      create policy tenant_isolation on pii.access_logs
        using (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

      create rule no_update_pii_access_logs as on update to pii.access_logs do instead nothing;
      create rule no_delete_pii_access_logs as on delete to pii.access_logs do instead nothing;
    `)
  }

  async down() {
    this.schema.raw(`
      drop rule if exists no_update_pii_access_logs on pii.access_logs;
      drop rule if exists no_delete_pii_access_logs on pii.access_logs;
      drop policy if exists tenant_isolation on pii.beneficiaries;
      drop policy if exists tenant_isolation on pii.asset_beneficiaries;
      drop policy if exists tenant_isolation on pii.access_logs;
      alter table pii.beneficiaries disable row level security;
      alter table pii.asset_beneficiaries disable row level security;
      alter table pii.access_logs disable row level security;
    `)
  }
}
```

- [ ] **Step 2: Rodar e commit**

```bash
node ace migration:run
git add database/migrations/
git commit -m "🔒 security(db): RLS on pii.* and append-only RULES on access_logs"
```

---

## Phase 8 — Audit infrastructure

### Task 26: Migrations audit_logs + security_audit_logs + RLS + RULES

**Files:**

- Create: 2 migrations

- [ ] **Step 1: `create_audit_logs`**

```bash
node ace make:migration create_audit_logs
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'audit_logs'

  async up() {
    this.schema.raw(`
      create table audit_logs (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid,
        actor_user_id uuid,
        entity_type text not null,
        entity_id text,
        action text not null,
        payload jsonb,
        ip_address inet,
        user_agent text,
        request_id uuid,
        created_at timestamptz not null default now()
      );
      create index audit_logs_tenant_entity_idx on audit_logs (tenant_id, entity_type, entity_id, created_at desc);
      create index audit_logs_tenant_actor_idx on audit_logs (tenant_id, actor_user_id, created_at desc);

      alter table audit_logs enable row level security;
      create policy tenant_isolation on audit_logs
        using (tenant_id is null OR tenant_id = current_setting('app.current_tenant_id', true)::uuid);

      create rule no_update_audit_logs as on update to audit_logs do instead nothing;
      create rule no_delete_audit_logs as on delete to audit_logs do instead nothing;
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 2: `create_security_audit_logs`**

```bash
node ace make:migration create_security_audit_logs
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'security_audit_logs'

  async up() {
    this.schema.raw(`
      create table security_audit_logs (
        id uuid primary key default gen_random_uuid(),
        ip_address inet,
        user_agent text,
        request_id uuid,
        action text not null,
        code text,
        email_hash text,
        payload jsonb,
        created_at timestamptz not null default now()
      );
      create index security_audit_logs_action_idx on security_audit_logs (action, created_at desc);

      create rule no_update_security_audit_logs as on update to security_audit_logs do instead nothing;
      create rule no_delete_security_audit_logs as on delete to security_audit_logs do instead nothing;
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 3: Rodar e commit**

```bash
node ace migration:run
git add database/migrations/
git commit -m "🔒 security(db): audit_logs (RLS + append-only) and security_audit_logs"
```

---

### Task 27: AuditService com PII validator

**Files:**

- Create: `app/shared/services/audit_service.ts`
- Create: `tests/integration/shared/audit_service.spec.ts`

- [ ] **Step 1: Test**

```typescript
// tests/integration/shared/audit_service.spec.ts
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import auditService from '#shared/services/audit_service'

test.group('AuditService', () => {
  test('record stores audit entry with tenant_id', async ({ assert }) => {
    const [t] = await db
      .from('tenants')
      .insert({
        name: 'T',
        slug: `t-${Date.now()}`,
        status: 'active',
        rbac_version: 1,
      })
      .returning('id')
    await auditService.record({
      tenantId: t.id,
      actorUserId: null,
      entityType: 'test',
      entityId: 'x',
      action: 'test_action',
      payload: { foo: 'bar' },
    })
    const log = await db
      .from('audit_logs')
      .where('action', 'test_action')
      .orderBy('created_at', 'desc')
      .first()
    assert.equal(log.tenant_id, t.id)
  })

  test('record rejects payload containing PII fields', async ({ assert }) => {
    const [t] = await db
      .from('tenants')
      .insert({
        name: 'T',
        slug: `t-${Date.now()}`,
        status: 'active',
        rbac_version: 1,
      })
      .returning('id')
    await assert.rejects(async () => {
      await auditService.record({
        tenantId: t.id,
        actorUserId: null,
        entityType: 'test',
        entityId: 'x',
        action: 'leak',
        payload: { cpf: '12345678900', name: 'João Silva' },
      })
    }, /PII detected/)
  })

  test('recordSecurity stores in security_audit_logs without tenant', async ({ assert }) => {
    await auditService.recordSecurity({
      action: 'login.failed',
      code: 'E_AUTH',
      payload: { reason: 'invalid_credentials' },
    })
    const log = await db
      .from('security_audit_logs')
      .where('action', 'login.failed')
      .orderBy('created_at', 'desc')
      .first()
    assert.exists(log)
  })
})
```

- [ ] **Step 2: Run failing**

```bash
pnpm test --files="tests/integration/shared/audit_service.spec.ts"
```

- [ ] **Step 3: Implementar**

```typescript
// app/shared/services/audit_service.ts
import db from '@adonisjs/lucid/services/db'

const PII_FIELD_RE =
  /^(cpf|cnpj|document|name|email|phone|telefone|password|secret|token|beneficiar(y|io|ies|ios))$/i

class AuditService {
  async record(params: {
    tenantId: string | null
    actorUserId: string | null
    entityType: string
    entityId?: string | null
    action: string
    payload?: object
    ipAddress?: string | null
    userAgent?: string | null
    requestId?: string | null
  }): Promise<void> {
    if (params.payload) {
      this.assertNoPii(params.payload)
    }
    await db.from('audit_logs').insert({
      tenant_id: params.tenantId,
      actor_user_id: params.actorUserId,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      action: params.action,
      payload: params.payload ?? null,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      request_id: params.requestId ?? null,
    })
  }

  async recordSecurity(params: {
    action: string
    code?: string
    emailHash?: string
    ipAddress?: string | null
    userAgent?: string | null
    requestId?: string | null
    payload?: object
  }): Promise<void> {
    await db.from('security_audit_logs').insert({
      action: params.action,
      code: params.code ?? null,
      email_hash: params.emailHash ?? null,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      request_id: params.requestId ?? null,
      payload: params.payload ?? null,
    })
  }

  private assertNoPii(obj: unknown, path = ''): void {
    if (obj === null || typeof obj !== 'object') return
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const here = path ? `${path}.${k}` : k
      if (PII_FIELD_RE.test(k)) {
        throw new Error(`PII detected in audit payload at: ${here}`)
      }
      if (v && typeof v === 'object') this.assertNoPii(v, here)
    }
  }
}

export default new AuditService()
```

- [ ] **Step 4: Run passing**

```bash
pnpm test --files="tests/integration/shared/audit_service.spec.ts"
```

- [ ] **Step 5: Commit**

```bash
git add app/shared/services/audit_service.ts tests/integration/shared/audit_service.spec.ts
git commit -m "🚀 feat(shared): AuditService with PII guard validator"
```

---

## Phase 9 — Job tracking, Queue infrastructure

### Task 28: Migrations radar_job_runs + worker_heartbeats + export_jobs + client_errors + retention

**Files:**

- Create: 5 migrations

- [ ] **Step 1: `create_radar_job_runs`**

```bash
node ace make:migration create_radar_job_runs
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'radar_job_runs'

  async up() {
    this.schema.raw(`
      create table radar_job_runs (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid,
        job_name text not null,
        queue_name text not null,
        bullmq_job_id text,
        bullmq_attempt int not null default 1,
        run_number int not null default 1,
        parent_run_id uuid references radar_job_runs(id),
        origin job_run_origin not null default 'http',
        target_type text,
        target_id uuid,
        status job_run_status not null,
        started_at timestamptz,
        finished_at timestamptz,
        duration_ms int generated always as (
          extract(epoch from (finished_at - started_at)) * 1000
        ) stored,
        error_code text,
        error_message text,
        error_stack text,
        metadata jsonb,
        request_id uuid,
        created_at timestamptz not null default now()
      );
      create index on radar_job_runs (tenant_id, status, created_at desc);
      create index on radar_job_runs (tenant_id, target_type, target_id);
      create index on radar_job_runs (parent_run_id);
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 2: `create_worker_heartbeats`**

```bash
node ace make:migration create_worker_heartbeats
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'worker_heartbeats'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.string('worker_id').primary()
      t.string('hostname').notNullable()
      t.integer('pid').notNullable()
      t.specificType('queues', 'text[]').notNullable()
      t.timestamp('started_at', { useTz: true }).notNullable()
      t.timestamp('last_seen_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 3: `create_export_jobs`**

```bash
node ace make:migration create_export_jobs
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'export_jobs'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      t.uuid('requested_by_user_id')
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      t.string('type').notNullable()
      t.jsonb('filters').nullable()
      t.specificType('status', 'export_status').notNullable().defaultTo('pending')
      t.text('output_path').nullable()
      t.timestamp('signed_url_expires_at', { useTz: true }).nullable()
      t.integer('row_count').nullable()
      t.timestamp('started_at', { useTz: true }).nullable()
      t.timestamp('finished_at', { useTz: true }).nullable()
      t.text('error_message').nullable()
      t.uuid('request_id').nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.index(['tenant_id', 'status', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 4: `create_client_errors`**

```bash
node ace make:migration create_client_errors
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'client_errors'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      t.uuid('tenant_id').nullable().references('id').inTable('tenants').onDelete('SET NULL')
      t.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.text('url').nullable()
      t.text('message').nullable()
      t.text('stack').nullable()
      t.text('component_stack').nullable()
      t.uuid('request_id').nullable()
      t.string('user_agent').nullable()
      t.specificType('ip_address', 'inet').nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.index(['tenant_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 5: `create_retention_tables`**

```bash
node ace make:migration create_retention_tables
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('retention_config', (t) => {
      t.string('log_type').primary()
      t.integer('retention_days').notNullable()
      t.integer('min_days_for_pii_access_logs').nullable()
      t.boolean('enabled').notNullable().defaultTo(true)
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    this.schema.createTable('retention_manifest', (t) => {
      t.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      t.string('log_type').notNullable()
      t.timestamp('range_from', { useTz: true }).notNullable()
      t.timestamp('range_to', { useTz: true }).notNullable()
      t.integer('estimated_rows').notNullable()
      t.specificType('status', 'retention_manifest_status').notNullable().defaultTo('pending')
      t.string('created_by').notNullable().defaultTo('system')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('applied_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.dropTable('retention_manifest')
    this.schema.dropTable('retention_config')
  }
}
```

- [ ] **Step 6: Rodar e commit**

```bash
node ace migration:run
git add database/migrations/
git commit -m "🗃️ refactor(db): radar_job_runs, worker_heartbeats, export_jobs, client_errors, retention"
```

---

### Task 29: QueueService (BullMQ wrapper) + JobRunService

**Files:**

- Create: `app/shared/services/queue_service.ts`
- Create: `app/shared/services/job_run_service.ts`

- [ ] **Step 1: QueueService**

```typescript
// app/shared/services/queue_service.ts
import type { Job, Processor } from 'bullmq'
import { Queue, Worker } from 'bullmq'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'

class QueueService {
  private queues = new Map<string, Queue>()
  private workers = new Map<string, Worker>()
  private prefix = 'radar:queue'

  getQueue(name: string): Queue {
    let queue = this.queues.get(name)
    if (!queue) {
      queue = new Queue(name, {
        prefix: this.prefix,
        connection: this.getConnection(),
        defaultJobOptions: {
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        },
      })
      this.queues.set(name, queue)
    }
    return queue
  }

  registerWorker(name: string, handler: Processor, concurrency = 1): Worker {
    const worker = new Worker(name, handler, {
      prefix: this.prefix,
      connection: this.getConnection(),
      concurrency,
    })
    worker.on('failed', (job: Job | undefined, err: Error) => {
      logger.error({ err, jobId: job?.id, queue: name }, 'job.failed')
    })
    worker.on('completed', (job: Job) => {
      logger.info(
        { jobId: job.id, queue: name, durationMs: Date.now() - job.timestamp },
        'job.completed'
      )
    })
    this.workers.set(name, worker)
    return worker
  }

  async shutdown(): Promise<void> {
    const promises: Promise<void>[] = []
    for (const [, worker] of this.workers) promises.push(worker.close())
    for (const [, queue] of this.queues) promises.push(queue.close())
    await Promise.all(promises)
    this.workers.clear()
    this.queues.clear()
  }

  private getConnection() {
    return {
      host: env.get('REDIS_HOST'),
      port: env.get('REDIS_PORT'),
      password: env.get('REDIS_PASSWORD') || undefined,
    }
  }
}

export default new QueueService()
```

- [ ] **Step 2: JobRunService**

```typescript
// app/shared/services/job_run_service.ts
import db from '@adonisjs/lucid/services/db'
import { sanitizeError } from '#shared/helpers/sanitize_error'
import app from '@adonisjs/core/services/app'

interface StartParams {
  tenantId?: string | null
  jobName: string
  queueName: string
  bullmqJobId?: string
  bullmqAttempt?: number
  runNumber?: number
  parentRunId?: string
  origin?: 'scheduler' | 'http' | 'manual_retry' | 'system'
  targetType?: string
  targetId?: string
  requestId?: string
  metadata?: object
}

class JobRunService {
  async start(params: StartParams): Promise<string> {
    const [row] = await db
      .from('radar_job_runs')
      .insert({
        tenant_id: params.tenantId ?? null,
        job_name: params.jobName,
        queue_name: params.queueName,
        bullmq_job_id: params.bullmqJobId ?? null,
        bullmq_attempt: params.bullmqAttempt ?? 1,
        run_number: params.runNumber ?? 1,
        parent_run_id: params.parentRunId ?? null,
        origin: params.origin ?? 'http',
        target_type: params.targetType ?? null,
        target_id: params.targetId ?? null,
        status: 'running',
        started_at: db.knexRawQuery('now()').knexQuery as any,
        metadata: params.metadata ?? null,
        request_id: params.requestId ?? null,
      })
      .returning(['id'])
    return row.id as string
  }

  async complete(runId: string, metadata?: object): Promise<void> {
    await db
      .from('radar_job_runs')
      .where('id', runId)
      .update({
        status: 'completed',
        finished_at: db.knexRawQuery('now()').knexQuery as any,
        metadata: metadata ?? null,
      })
  }

  async skip(runId: string, reason: string): Promise<void> {
    await db
      .from('radar_job_runs')
      .where('id', runId)
      .update({
        status: 'skipped',
        finished_at: db.knexRawQuery('now()').knexQuery as any,
        error_code: 'E_SKIPPED',
        error_message: reason,
      })
  }

  async fail(runId: string, err: any): Promise<void> {
    const sanitized = sanitizeError(err, { mode: app.inProduction ? 'prod' : 'dev' })
    await db
      .from('radar_job_runs')
      .where('id', runId)
      .update({
        status: 'failed',
        finished_at: db.knexRawQuery('now()').knexQuery as any,
        error_code: err?.code ?? 'E_INTERNAL',
        error_message: sanitized.message,
        error_stack: sanitized.stack ?? null,
      })
  }
}

export default new JobRunService()
```

- [ ] **Step 3: Verificar typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add app/shared/services/{queue_service,job_run_service}.ts
git commit -m "🚀 feat(shared): QueueService (BullMQ) and JobRunService"
```

---

### Task 30: bin/worker.ts + start/jobs.ts

**Files:**

- Create: `bin/worker.ts`
- Create: `start/jobs.ts`
- Modify: `package.json`

- [ ] **Step 1: start/jobs.ts (placeholder, handlers vão se registrando)**

```typescript
// start/jobs.ts
import queueService from '#shared/services/queue_service'

export const queues = {
  siopImport: { name: 'siop:import', concurrency: 1, attempts: 3 },
  siopReprocess: { name: 'siop:reprocess', concurrency: 1, attempts: 3 },
  siopReconcile: { name: 'siop:reconcile', concurrency: 1, attempts: 3 },
  purgeStaging: { name: 'maintenance:purge_staging', concurrency: 1, attempts: 2 },
  retentionPolicy: { name: 'maintenance:apply_retention_policy', concurrency: 1, attempts: 1 },
  refreshAggregates: { name: 'maintenance:refresh_aggregates', concurrency: 1, attempts: 3 },
  vacuumHint: { name: 'maintenance:vacuum_hint', concurrency: 1, attempts: 1 },
  exportPrecatorios: { name: 'exports:precatorios_csv', concurrency: 2, attempts: 3 },
} as const

export async function bootWorkers() {
  // Cada handler é registrado por sua phase. Inicialmente: noop placeholders.
  // Será preenchido nas Phases 14, 21, 22.
}
```

- [ ] **Step 2: bin/worker.ts**

```typescript
// bin/worker.ts
import { Ignitor, prettyPrintError } from '@adonisjs/core'
import { defineConfig } from '@adonisjs/core/app'
import logger from '@adonisjs/core/services/logger'
import queueService from '#shared/services/queue_service'
import { bootWorkers } from '#start/jobs'

new Ignitor(import.meta.url, {
  importer: (filePath) => import(new URL(filePath, import.meta.url).href),
})
  .tap((app) => {
    app.booting(async () => {
      await import('#start/env')
    })
    app.terminating(async () => {
      logger.info('worker shutting down')
      await queueService.shutdown()
    })
  })
  .createApp('console')
  .start(async () => {
    await bootWorkers()
    logger.info('worker booted, listening on queues')
    process.on('SIGTERM', () => process.exit(0))
    process.on('SIGINT', () => process.exit(0))
    // mantém processo vivo
    await new Promise(() => {})
  })
  .catch((err) => {
    process.exitCode = 1
    prettyPrintError(err)
  })
```

- [ ] **Step 3: Adicionar script no package.json**

No bloco `scripts`:

```json
"start:worker": "node --import=@poppinss/ts-exec bin/worker.ts"
```

- [ ] **Step 4: Validar boot do worker**

```bash
pnpm start:worker &
sleep 3
ps aux | grep worker
kill %1
```

Expected: worker boot logs sem erro.

- [ ] **Step 5: Commit**

```bash
git add bin/worker.ts start/jobs.ts package.json
git commit -m "🚀 feat(infra): bin/worker.ts, start/jobs.ts skeleton, pnpm start:worker script"
```

---

## Phase 10 — Materialized views

### Task 31: Migration materialized views (dashboard, debtor_aggregates, asset_yearly_stats)

**Files:**

- Create: `database/migrations/<ts>_create_materialized_views.ts`

- [ ] **Step 1: Migration**

```bash
node ace make:migration create_materialized_views
```

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      create materialized view v_dashboard_metrics as
      select
        tenant_id,
        count(*) as total_assets,
        count(distinct debtor_id) as debtors_count,
        coalesce(sum(face_value), 0) as total_face_value,
        count(*) filter (where lifecycle_status = 'expedited') as expedited_count,
        count(*) filter (where lifecycle_status = 'paid') as paid_count,
        count(*) filter (where created_at > now() - interval '30 days') as new_30d
      from public.precatorio_assets
      where deleted_at is null
      group by tenant_id;
      create unique index on v_dashboard_metrics(tenant_id);

      create materialized view v_debtor_aggregates as
      select
        pa.tenant_id, pa.debtor_id, d.name as debtor_name,
        count(*) as asset_count,
        coalesce(sum(pa.face_value), 0) as total_face_value,
        coalesce(sum(pa.estimated_updated_value), 0) as total_estimated_value
      from public.precatorio_assets pa
      join public.debtors d on d.id = pa.debtor_id
      where pa.deleted_at is null
      group by pa.tenant_id, pa.debtor_id, d.name;
      create unique index on v_debtor_aggregates(tenant_id, debtor_id);

      create materialized view v_asset_yearly_stats as
      select tenant_id, exercise_year, count(*) as count, coalesce(sum(face_value), 0) as total
      from public.precatorio_assets
      where deleted_at is null and exercise_year is not null
      group by tenant_id, exercise_year;
      create unique index on v_asset_yearly_stats(tenant_id, exercise_year);
    `)
  }

  async down() {
    this.schema.raw(`
      drop materialized view if exists v_asset_yearly_stats;
      drop materialized view if exists v_debtor_aggregates;
      drop materialized view if exists v_dashboard_metrics;
    `)
  }
}
```

- [ ] **Step 2: Rodar e commit**

```bash
node ace migration:run
git add database/migrations/
git commit -m "🗃️ refactor(db): materialized views for dashboard"
```

---

## Phase 11 — Crypto setup

### Task 32: HashService (HMAC-SHA256)

**Files:**

- Create: `app/modules/pii/services/hash_service.ts`
- Create: `tests/unit/modules/pii/hash_service.spec.ts`

- [ ] **Step 1: Test**

```typescript
// tests/unit/modules/pii/hash_service.spec.ts
import { test } from '@japa/runner'
import hashService from '#modules/pii/services/hash_service'

test.group('HashService', () => {
  test('beneficiaryHash deterministic for same input', ({ assert }) => {
    const a = hashService.beneficiaryHash('João Silva', '12345678900')
    const b = hashService.beneficiaryHash('João Silva', '12345678900')
    assert.equal(a, b)
  })

  test('beneficiaryHash normalizes name (case + accents)', ({ assert }) => {
    const a = hashService.beneficiaryHash('João Silva', '12345678900')
    const b = hashService.beneficiaryHash('JOAO SILVA', '12345678900')
    assert.equal(a, b)
  })

  test('beneficiaryHash differs across documents', ({ assert }) => {
    const a = hashService.beneficiaryHash('João Silva', '11111111111')
    const b = hashService.beneficiaryHash('João Silva', '22222222222')
    assert.notEqual(a, b)
  })

  test('beneficiaryHash produces 64-char hex', ({ assert }) => {
    const a = hashService.beneficiaryHash('Foo', '111')
    assert.match(a, /^[a-f0-9]{64}$/)
  })
})
```

- [ ] **Step 2: Run failing**

- [ ] **Step 3: Implementar**

```typescript
// app/modules/pii/services/hash_service.ts
import { createHmac } from 'node:crypto'
import env from '#start/env'

class HashService {
  private pepper(): string {
    return env.get('PII_HASH_PEPPER')
  }

  beneficiaryHash(name: string, document?: string | null): string {
    const norm = `${this.normalize(name)}|${this.onlyDigits(document ?? '')}`
    return createHmac('sha256', this.pepper()).update(norm).digest('hex')
  }

  private normalize(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')
  }

  private onlyDigits(s: string): string {
    return (s ?? '').replace(/\D+/g, '')
  }
}

export default new HashService()
```

- [ ] **Step 4: Run passing & commit**

```bash
pnpm test --files="tests/unit/modules/pii/hash_service.spec.ts"
git add app/modules/pii/services/hash_service.ts tests/unit/modules/pii/hash_service.spec.ts
git commit -m "🔒 security(pii): HashService HMAC-SHA256 with PII_HASH_PEPPER"
```

---

## Phase 12 — Auth flow + Tenant select

### Task 33: Login controller + view + audit

**Files:**

- Create: `app/modules/auth/controllers/login_controller.ts`
- Create: `app/modules/auth/validators/login_validator.ts`
- Create: `app/modules/auth/routes.ts`
- Create: `inertia/pages/auth/login.tsx`
- Modify: `start/routes.ts`

- [ ] **Step 1: Validator**

```typescript
// app/modules/auth/validators/login_validator.ts
import vine from '@vinejs/vine'

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail(),
    password: vine.string().minLength(1).maxLength(200),
  })
)
```

- [ ] **Step 2: Login controller**

```typescript
// app/modules/auth/controllers/login_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import { createHash } from 'node:crypto'
import { loginValidator } from '#modules/auth/validators/login_validator'
import auditService from '#shared/services/audit_service'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'

export default class LoginController {
  async show({ inertia }: HttpContext) {
    return inertia.render('auth/login')
  }

  async store(ctx: HttpContext) {
    const { email, password } = await ctx.request.validateUsing(loginValidator)
    try {
      const user = await User.verifyCredentials(email, password)
      await ctx.auth.use('web').login(user)
      await ctx.session.regenerate()

      // resolve tenant ativo automaticamente se 1 membership
      const memberships = await db
        .from('tenant_memberships')
        .where('user_id', user.id)
        .andWhere('status', 'active')
        .select('tenant_id')

      if (memberships.length === 1) {
        ctx.session.put('active_tenant_id', memberships[0].tenant_id)
        return ctx.response.redirect('/dashboard')
      }
      return ctx.response.redirect('/tenants/select')
    } catch (err) {
      await auditService.recordSecurity({
        action: 'login.failed',
        code: 'E_AUTH',
        emailHash: createHash('sha256').update(email).digest('hex'),
        ipAddress: ctx.request.ip(),
        userAgent: ctx.request.header('user-agent'),
        requestId: ctx.requestId,
      })
      ctx.session.flashErrors({ email: 'Credenciais inválidas' })
      return ctx.response.redirect().back()
    }
  }

  async destroy(ctx: HttpContext) {
    await ctx.auth.use('web').logout()
    ctx.session.clear()
    return ctx.response.redirect('/auth/login')
  }
}
```

- [ ] **Step 3: Routes do módulo**

```typescript
// app/modules/auth/routes.ts
import router from '@adonisjs/core/services/router'

const LoginController = () => import('#modules/auth/controllers/login_controller')

router
  .group(() => {
    router.get('/login', [LoginController, 'show']).as('auth.login.show').use('guest')
    router.post('/login', [LoginController, 'store']).as('auth.login.store').use('guest')
    router.post('/logout', [LoginController, 'destroy']).as('auth.logout').use('auth')
  })
  .prefix('/auth')
```

- [ ] **Step 4: Importar em start/routes.ts**

Adicionar no topo de `start/routes.ts`:

```typescript
import '#modules/auth/routes'
```

- [ ] **Step 5: Inertia page**

```typescript
// inertia/pages/auth/login.tsx
import {Head, useForm, Link} from '@inertiajs/react'
import {useState} from 'react'

export default function Login() {
  const form = useForm({email: '', password: ''})

  function submit(e: React.FormEvent) {
    e.preventDefault()
    form.post('/auth/login')
  }

  return (
    <>
      <Head title = "Entrar - juridicai" / >
    <main style = {
  {
    maxWidth: 400, margin
  :
    '4rem auto', padding
  :
    '2rem'
  }
}>
  <h1>juridicai < /h1>
  < form
  onSubmit = {submit} >
    <label>
      Email
    < input
  type = "email"
  required
  value = {form.data.email}
  onChange = {(e)
=>
  form.setData('email', e.target.value)
}
  />
  < /label>
  {
    form.errors.email && <p style = {
    {
      color: 'red'
    }
  }>
    {
      form.errors.email
    }
    </p>}
    < label >
    Senha
    < input
    type = "password"
    required
    value = {form.data.password}
    onChange = {(e)
  =>
    form.setData('password', e.target.value)
  }
    />
    < /label>
    < button
    type = "submit"
    disabled = {form.processing} > Entrar < /button>
      < /form>
      < /main>
      < />
  )
  }
```

- [ ] **Step 6: Smoke test**

```bash
pnpm dev &
sleep 5
curl -s http://localhost:3333/auth/login | grep -i "juridicai"
kill %1
```

Expected: HTML contém "juridicai".

- [ ] **Step 7: Commit**

```bash
git add app/modules/auth/ inertia/pages/auth/ start/routes.ts
git commit -m "🚀 feat(auth): login flow with session.regenerate and security audit"
```

---

### Task 34: Tenant select flow

**Files:**

- Create: `app/modules/tenant/controllers/tenant_select_controller.ts`
- Create: `app/modules/tenant/services/membership_service.ts`
- Create: `app/modules/tenant/routes.ts`
- Create: `inertia/pages/tenants/select.tsx`

- [ ] **Step 1: Service**

```typescript
// app/modules/tenant/services/membership_service.ts
import db from '@adonisjs/lucid/services/db'

class MembershipService {
  async listActive(userId: string) {
    return db
      .from('tenant_memberships as tm')
      .join('tenants as t', 't.id', 'tm.tenant_id')
      .where('tm.user_id', userId)
      .andWhere('tm.status', 'active')
      .andWhere('t.status', 'active')
      .select('t.id', 't.name', 't.slug', 'tm.id as membership_id')
  }

  async findActive(userId: string, tenantId: string) {
    return db
      .from('tenant_memberships')
      .where('user_id', userId)
      .andWhere('tenant_id', tenantId)
      .andWhere('status', 'active')
      .first()
  }
}

export default new MembershipService()
```

- [ ] **Step 2: Controller**

```typescript
// app/modules/tenant/controllers/tenant_select_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import membershipService from '#modules/tenant/services/membership_service'
import auditService from '#shared/services/audit_service'

const selectValidator = vine.compile(
  vine.object({
    tenant_id: vine.string().uuid(),
  })
)

export default class TenantSelectController {
  async show({ auth, inertia, response }: HttpContext) {
    const memberships = await membershipService.listActive(auth.user!.id)
    if (memberships.length === 0) {
      return inertia.render('errors/show', {
        status: 403,
        code: 'E_NO_MEMBERSHIP',
        message: 'Sua conta não tem acesso a nenhuma organização ativa.',
        requestId: '',
      })
    }
    if (memberships.length === 1) {
      response.cookie('active_tenant_id', memberships[0].id)
      return response.redirect('/dashboard')
    }
    return inertia.render('tenants/select', { memberships })
  }

  async store(ctx: HttpContext) {
    const { tenant_id } = await ctx.request.validateUsing(selectValidator)
    const userId = ctx.auth.user!.id
    const membership = await membershipService.findActive(userId, tenant_id)
    if (!membership) {
      return ctx.response.forbidden({ error: { code: 'E_TENANT_MEMBERSHIP_INACTIVE' } })
    }
    const previous = ctx.session.get('active_tenant_id') as string | undefined
    ctx.session.put('active_tenant_id', tenant_id)
    await ctx.session.regenerate()
    await auditService.record({
      tenantId: tenant_id,
      actorUserId: userId,
      entityType: 'tenant',
      entityId: tenant_id,
      action: 'tenant_switched',
      payload: { from: previous ?? null, to: tenant_id },
      ipAddress: ctx.request.ip(),
      userAgent: ctx.request.header('user-agent'),
      requestId: ctx.requestId,
    })
    return ctx.response.redirect('/dashboard')
  }
}
```

- [ ] **Step 3: Routes**

```typescript
// app/modules/tenant/routes.ts
import router from '@adonisjs/core/services/router'

const TenantSelectController = () => import('#modules/tenant/controllers/tenant_select_controller')

router
  .group(() => {
    router.get('/select', [TenantSelectController, 'show']).as('tenants.select.show')
    router.post('/select', [TenantSelectController, 'store']).as('tenants.select.store')
  })
  .prefix('/tenants')
  .use('auth')
```

- [ ] **Step 4: Importar em start/routes.ts**

```typescript
import '#modules/tenant/routes'
```

- [ ] **Step 5: Inertia page**

```typescript
// inertia/pages/tenants/select.tsx
import {Head, router} from '@inertiajs/react'

interface Props {
  memberships: Array<{ id: string; name: string; slug: string }>
}

export default function TenantsSelect({memberships}: Props) {
  return (
    <>
      <Head title = "Selecionar organização" / >
    <main style = {
  {
    maxWidth: 600, margin
  :
    '4rem auto'
  }
}>
  <h1>Selecione
  a
  organização
  ativa < /h1>
  < ul
  style = {
  {
    listStyle: 'none', padding
  :
    0
  }
}>
  {
    memberships.map((m) => (
      <li key = {m.id}
    style = {
    {
      marginBottom: '1rem'
    }
  }>
    <button onClick = {()
  =>
    router.post('/tenants/select', {tenant_id: m.id})
  }>
    {
      m.name
    }
    ({m.slug})
    < /button>
    < /li>
  ))
  }
  </ul>
  < /main>
  < />
)
}
```

- [ ] **Step 6: Commit**

```bash
git add app/modules/tenant/ inertia/pages/tenants/ start/routes.ts
git commit -m "🚀 feat(tenant): tenant select flow with audit and session.regenerate"
```

---

### Task 35: Seeder do tenant Benício + admin user

**Files:**

- Create: `database/seeders/tenant_benicio_seeder.ts`
- Modify: `database/seeders/index_seeder.ts`

- [ ] **Step 1: Seeder**

```bash
node ace make:seeder TenantBenicioSeeder
```

```typescript
// database/seeders/tenant_benicio_seeder.ts
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'

export default class extends BaseSeeder {
  async run() {
    const [tenant] = await db
      .from('tenants')
      .insert({
        name: 'Benício',
        slug: 'benicio',
        status: 'active',
        rbac_version: 1,
      })
      .onConflict('slug')
      .merge(['updated_at'])
      .returning(['id'])

    const passwordHash = await hash.use('argon').make('admin1234')
    const [user] = await db
      .from('users')
      .insert({
        name: 'Admin Benício',
        email: 'admin@benicio.local',
        password_hash: passwordHash,
        status: 'active',
      })
      .onConflict('email')
      .merge(['updated_at'])
      .returning(['id'])

    await db
      .from('tenant_memberships')
      .insert({
        tenant_id: tenant.id,
        user_id: user.id,
        status: 'active',
      })
      .onConflict(['tenant_id', 'user_id'])
      .ignore()

    const tenantAdminRole = await db.from('roles').where('slug', 'tenant_admin').first()
    if (tenantAdminRole) {
      await db
        .from('user_roles')
        .insert({
          tenant_id: tenant.id,
          user_id: user.id,
          role_id: tenantAdminRole.id,
        })
        .onConflict(['tenant_id', 'user_id', 'role_id'])
        .ignore()
    }
  }
}
```

- [ ] **Step 2: Update index_seeder**

```typescript
// database/seeders/index_seeder.ts
import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    await this.runner.runFile('./database/seeders/permissions_seeder')
    await this.runner.runFile('./database/seeders/roles_seeder')
    await this.runner.runFile('./database/seeders/tenant_benicio_seeder')
  }
}
```

- [ ] **Step 3: Rodar e verificar**

```bash
node ace db:seed --files="./database/seeders/index_seeder.ts"
docker compose exec postgres psql -U juridicai -d juridicai_dev -c "select email from users; select name from tenants;"
```

Expected: `admin@benicio.local`, `Benício`.

- [ ] **Step 4: Commit**

```bash
git add database/seeders/
git commit -m "🌱 seed: tenant Benício, admin user with tenant_admin role"
```

---

## Phase 13 — SIOP parsers (TDD strict)

### Task 36: CNJ parser

**Files:**

- Create: `app/modules/siop/parsers/cnj_parser.ts`
- Create: `tests/unit/modules/siop/cnj_parser.spec.ts`

- [ ] **Step 1: Test**

```typescript
// tests/unit/modules/siop/cnj_parser.spec.ts
import { test } from '@japa/runner'
import { parseCnj, isValidCnj } from '#modules/siop/parsers/cnj_parser'

test.group('cnj_parser', () => {
  test('parses formatted CNJ', ({ assert }) => {
    const r = parseCnj('0001234-56.2023.4.03.6100')
    assert.equal(r.normalized, '00012345620234036100')
    assert.equal(r.tribunal, '03')
    assert.equal(r.year, 2023)
  })

  test('parses CNJ without punctuation', ({ assert }) => {
    const r = parseCnj('00012345620234036100')
    assert.equal(r.normalized, '00012345620234036100')
  })

  test('rejects CNJ with wrong length', ({ assert }) => {
    assert.throws(() => parseCnj('123'), /invalid length/i)
  })

  test('rejects CNJ with bad digit verifier', ({ assert }) => {
    assert.throws(() => parseCnj('0001234-99.2023.4.03.6100'), /invalid verifier/i)
  })

  test('isValidCnj returns false for invalid input', ({ assert }) => {
    assert.isFalse(isValidCnj('xxx'))
    assert.isFalse(isValidCnj(null as any))
    assert.isTrue(isValidCnj('0001234-56.2023.4.03.6100'))
  })
})
```

- [ ] **Step 2: Run failing**

- [ ] **Step 3: Implement**

```typescript
// app/modules/siop/parsers/cnj_parser.ts
export interface ParsedCnj {
  normalized: string // 20 dígitos
  sequencial: string
  verifier: string
  year: number
  branch: string // ramo da Justiça
  tribunal: string
  origin: string
}

export function parseCnj(input: string): ParsedCnj {
  const digits = (input ?? '').replace(/\D+/g, '')
  if (digits.length !== 20) {
    throw new Error(`CNJ invalid length: got ${digits.length}, expected 20`)
  }

  const sequencial = digits.slice(0, 7)
  const verifier = digits.slice(7, 9)
  const year = parseInt(digits.slice(9, 13), 10)
  const branch = digits.slice(13, 14)
  const tribunal = digits.slice(14, 16)
  const origin = digits.slice(16, 20)

  // Validação dígito CNJ (mod 97)
  const noVerifier = sequencial + digits.slice(9, 20)
  const computed = 98 - (BigInt(noVerifier + '00') % 97n)
  const computedStr = computed.toString().padStart(2, '0')
  if (computedStr !== verifier) {
    throw new Error(`CNJ invalid verifier: expected ${computedStr}, got ${verifier}`)
  }

  return { normalized: digits, sequencial, verifier, year, branch, tribunal, origin }
}

export function isValidCnj(input: unknown): boolean {
  if (typeof input !== 'string') return false
  try {
    parseCnj(input)
    return true
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Run passing**

- [ ] **Step 5: Commit**

```bash
git add app/modules/siop/parsers/cnj_parser.ts tests/unit/modules/siop/cnj_parser.spec.ts
git commit -m "🚀 feat(siop): CNJ parser with mod-97 verifier validation"
```

---

### Task 37: Value parser (locale BR) e DebtorNormalizer

**Files:**

- Create: `app/modules/siop/parsers/value_parser.ts`
- Create: `app/modules/siop/parsers/debtor_normalizer.ts`
- Create: `tests/unit/modules/siop/value_parser.spec.ts`
- Create: `tests/unit/modules/siop/debtor_normalizer.spec.ts`

- [ ] **Step 1: Tests**

```typescript
// tests/unit/modules/siop/value_parser.spec.ts
import { test } from '@japa/runner'
import { parseValue } from '#modules/siop/parsers/value_parser'

test.group('value_parser', () => {
  test('parses BR format with thousands and decimals', ({ assert }) => {
    assert.equal(parseValue('1.234.567,89'), 1234567.89)
  })
  test('parses US fallback', ({ assert }) => {
    assert.equal(parseValue('1234567.89'), 1234567.89)
  })
  test('parses with R$ prefix', ({ assert }) => {
    assert.equal(parseValue('R$ 1.234,56'), 1234.56)
  })
  test('returns null for empty', ({ assert }) => {
    assert.isNull(parseValue(''))
    assert.isNull(parseValue(null))
  })
  test('parses negative', ({ assert }) => {
    assert.equal(parseValue('-1.234,56'), -1234.56)
  })
})
```

```typescript
// tests/unit/modules/siop/debtor_normalizer.spec.ts
import { test } from '@japa/runner'
import { normalizeDebtor } from '#modules/siop/parsers/debtor_normalizer'

test.group('debtor_normalizer', () => {
  test('strips accents and lowercases', ({ assert }) => {
    const r = normalizeDebtor('Município de São Paulo')
    assert.equal(r.normalizedName, 'MUNICIPIO DE SAO PAULO')
    assert.equal(r.normalizedKey, 'municipio_de_sao_paulo')
  })
  test('"Prefeitura Municipal de X" same key as "Município de X"', ({ assert }) => {
    const a = normalizeDebtor('Prefeitura Municipal de Campinas')
    const b = normalizeDebtor('Município de Campinas')
    assert.equal(a.normalizedKey, b.normalizedKey)
  })
  test('classifies debtor_type for "União"', ({ assert }) => {
    const r = normalizeDebtor('União')
    assert.equal(r.debtorType, 'union')
  })
  test('classifies for state', ({ assert }) => {
    const r = normalizeDebtor('Estado de São Paulo')
    assert.equal(r.debtorType, 'state')
  })
  test('classifies autarchy by name', ({ assert }) => {
    const r = normalizeDebtor('INSS - Instituto Nacional do Seguro Social')
    assert.equal(r.debtorType, 'autarchy')
  })
})
```

- [ ] **Step 2: Run failing**

- [ ] **Step 3: Implement value_parser**

```typescript
// app/modules/siop/parsers/value_parser.ts
export function parseValue(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null
  let s = String(input).trim()
  if (!s) return null
  s = s.replace(/^R\$\s*/i, '')
  // BR: ponto separador de milhar, vírgula decimal
  if (/,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const n = Number(s)
  if (Number.isNaN(n)) return null
  return Math.round(n * 100) / 100
}
```

- [ ] **Step 4: Implement debtor_normalizer**

```typescript
// app/modules/siop/parsers/debtor_normalizer.ts
export type DebtorType = 'union' | 'state' | 'municipality' | 'autarchy' | 'foundation'

export interface NormalizedDebtor {
  normalizedName: string
  normalizedKey: string
  debtorType: DebtorType
}

const PREFIXES_TO_STRIP = [
  /^prefeitura municipal de\b/i,
  /^pref\.?\s+mun\.?\s+de\b/i,
  /^governo do estado de\b/i,
  /^governo do\b/i,
]

export function normalizeDebtor(name: string): NormalizedDebtor {
  let cleaned = name.trim()
  for (const re of PREFIXES_TO_STRIP) {
    cleaned = cleaned.replace(re, '').trim()
  }
  // se prefeitura → traduzir pra "Município de X"
  cleaned = cleaned
    .replace(/^município de\b/i, 'Município de')
    .replace(/^estado de\b/i, 'Estado de')

  const stripAccents = cleaned.normalize('NFD').replace(/[̀-ͯ]/g, '')
  const normalizedName = stripAccents.toUpperCase().replace(/\s+/g, ' ').trim()
  const normalizedKey = normalizedName.toLowerCase().replace(/\s+/g, '_')

  const debtorType = classifyType(normalizedName)
  return { normalizedName, normalizedKey, debtorType }
}

function classifyType(normalized: string): DebtorType {
  if (/^UNIAO\b/.test(normalized)) return 'union'
  if (/^ESTADO DE/.test(normalized)) return 'state'
  if (/^MUNICIPIO DE/.test(normalized)) return 'municipality'
  if (
    /INSS|INCRA|FUNAI|FUNASA|IBAMA|ICMBIO|ANATEL|ANAC|INPI|CADE|DNIT|UNIVERSIDADE|UFR|UFC|UFP|UFM|UFG|IFR|IFE|IFP|UFL|UFV|UFB|UFS/.test(
      normalized
    )
  ) {
    return 'autarchy'
  }
  if (/FUNDACAO|FUNDAC\.|FUND\./.test(normalized)) return 'foundation'
  return 'autarchy'
}
```

- [ ] **Step 5: Run passing**

```bash
pnpm test --files="tests/unit/modules/siop/value_parser.spec.ts" --files="tests/unit/modules/siop/debtor_normalizer.spec.ts"
```

- [ ] **Step 6: Commit**

```bash
git add app/modules/siop/parsers/{value_parser,debtor_normalizer}.ts tests/unit/modules/siop/{value_parser,debtor_normalizer}.spec.ts
git commit -m "🚀 feat(siop): parseValue (BR locale) and normalizeDebtor with type classification"
```

---

## Phase 14 — SIOP Import Service & Handler

### Task 38: SiopImportService — pipeline em chunks

**Files:**

- Create: `app/modules/siop/services/siop_import_service.ts`
- Create: `tests/integration/modules/siop/siop_import_service.spec.ts`
- Create: `tests/fixtures/siop/valid_2024_small.xlsx`

> **Nota:** A fixture `valid_2024_small.xlsx` deve ter ~50 rows com colunas: `cnj`, `devedor`, `exercicio`,`valor_face`,
> `natureza`, `numero_precatorio`. Pode ser gerada manualmente em LibreOffice ou via script. Veja
> `tests/fixtures/siop/README.md` no Task 80.

- [ ] **Step 1: Integration test (alto nível)**

```typescript
// tests/integration/modules/siop/siop_import_service.spec.ts
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { resolve } from 'node:path'
import siopImportService from '#modules/siop/services/siop_import_service'
import { withTenantRls } from '#shared/helpers/with_tenant_rls'

test.group('SiopImportService', (group) => {
  let tenantId: string

  group.each.setup(async () => {
    const [t] = await db
      .from('tenants')
      .insert({
        name: 'T',
        slug: `t-${Date.now()}`,
        status: 'active',
        rbac_version: 1,
      })
      .returning('id')
    tenantId = t.id
  })

  test('imports valid XLSX populating staging and assets', async ({ assert }) => {
    const fixturePath = resolve('tests/fixtures/siop/valid_2024_small.xlsx')
    const importId = await siopImportService.createImport({
      tenantId,
      filePath: fixturePath,
      exerciseYear: 2024,
      checksum: 'fixture-2024-small',
      uploadedByUserId: null,
    })

    await siopImportService.run(importId)

    const imp = await db.from('siop_imports').where('id', importId).first()
    assert.equal(imp.status, 'completed')
    assert.isAbove(imp.inserted, 0)

    const assets = await db.from('precatorio_assets').where('tenant_id', tenantId).count('* as c')
    assert.isAbove(Number(assets[0].c), 0)
  })

  test('idempotent: re-running same import does not duplicate assets', async ({ assert }) => {
    const fixturePath = resolve('tests/fixtures/siop/valid_2024_small.xlsx')
    const importId = await siopImportService.createImport({
      tenantId,
      filePath: fixturePath,
      exerciseYear: 2024,
      checksum: 'fixture-idem',
      uploadedByUserId: null,
    })
    await siopImportService.run(importId)
    const before = await db.from('precatorio_assets').where('tenant_id', tenantId).count('* as c')

    // re-run forced
    await siopImportService.run(importId, { force: true })

    const after = await db.from('precatorio_assets').where('tenant_id', tenantId).count('* as c')
    assert.equal(Number(before[0].c), Number(after[0].c))
  })
})
```

- [ ] **Step 2: Run failing**

- [ ] **Step 3: Implementar SiopImportService (esqueleto)**

```typescript
// app/modules/siop/services/siop_import_service.ts
import db from '@adonisjs/lucid/services/db'
import { withTenantRls } from '#shared/helpers/with_tenant_rls'
import { parseCnj, isValidCnj } from '#modules/siop/parsers/cnj_parser'
import { parseValue } from '#modules/siop/parsers/value_parser'
import { normalizeDebtor } from '#modules/siop/parsers/debtor_normalizer'
import { createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import ExcelJS from 'exceljs'
import logger from '@adonisjs/core/services/logger'

interface CreateImportParams {
  tenantId: string
  filePath: string
  exerciseYear: number
  checksum: string
  uploadedByUserId: string | null
  originalFilename?: string
  mimeType?: string
  fileSizeBytes?: number
}

class SiopImportService {
  async createImport(params: CreateImportParams): Promise<string> {
    return db.transaction(async (trx) => {
      const [src] = await trx
        .from('source_records')
        .insert({
          tenant_id: params.tenantId,
          source: 'siop',
          source_file_path: params.filePath,
          source_checksum: params.checksum,
          original_filename: params.originalFilename ?? null,
          mime_type: params.mimeType ?? null,
          file_size_bytes: params.fileSizeBytes ?? null,
          collected_at: trx.knexRawQuery('now()').knexQuery as any,
        })
        .onConflict(['tenant_id', 'source', 'source_checksum'])
        .merge(['original_filename', 'mime_type', 'file_size_bytes'])
        .returning('id')

      const existing = await trx
        .from('siop_imports')
        .where('tenant_id', params.tenantId)
        .andWhere('source', 'siop')
        .andWhere('exercise_year', params.exerciseYear)
        .andWhere('source_record_id', src.id)
        .first()

      if (existing) {
        if (existing.status === 'completed') {
          throw Object.assign(new Error('E_IMPORT_ALREADY_EXISTS'), {
            code: 'E_IMPORT_ALREADY_EXISTS',
            status: 409,
            importId: existing.id,
          })
        }
        return existing.id // pending/running/failed/partial → reusa
      }

      const [imp] = await trx
        .from('siop_imports')
        .insert({
          tenant_id: params.tenantId,
          exercise_year: params.exerciseYear,
          source_record_id: src.id,
          source: 'siop',
          status: 'pending',
          uploaded_by_user_id: params.uploadedByUserId,
        })
        .returning('id')
      return imp.id
    })
  }

  async tryLock(importId: string): Promise<boolean> {
    const result = await db.rawQuery(`select pg_try_advisory_xact_lock(hashtext(?)) as locked`, [
      importId,
    ])
    return result.rows[0].locked === true
  }

  async run(importId: string, opts: { force?: boolean } = {}): Promise<void> {
    const imp = await db.from('siop_imports').where('id', importId).first()
    if (!imp) throw new Error('import not found')

    await db
      .from('siop_imports')
      .where('id', importId)
      .update({
        status: 'running',
        started_at: db.knexRawQuery('now()').knexQuery as any,
      })

    const source = await db.from('source_records').where('id', imp.source_record_id).first()

    let totalRows = 0
    let inserted = 0
    let updatedCount = 0
    let skipped = 0
    let errorsCount = 0

    try {
      // PASS 1 — parse XLSX em batches → staging
      const stagingBatch: any[] = []
      const wb = new ExcelJS.stream.xlsx.WorkbookReader(source.source_file_path, {})
      for await (const ws of wb) {
        for await (const row of ws) {
          totalRows++
          const obj = this.rowToObj(row)
          if (!obj) continue
          stagingBatch.push({ import_id: importId, raw_data: obj, validation_status: 'pending' })
          if (stagingBatch.length >= 1000) {
            await withTenantRls(imp.tenant_id, async (trx) => {
              await trx.from('siop_staging_rows').multiInsert(stagingBatch.splice(0, 1000))
            })
          }
        }
      }
      if (stagingBatch.length) {
        await withTenantRls(imp.tenant_id, async (trx) => {
          await trx.from('siop_staging_rows').multiInsert(stagingBatch)
        })
      }

      // PASS 2 — normalize staging
      await withTenantRls(imp.tenant_id, async (trx) => {
        const rows = await trx
          .from('siop_staging_rows')
          .where('import_id', importId)
          .andWhere('validation_status', 'pending')
        for (const r of rows) {
          const validation = this.validateRow(r.raw_data)
          await trx
            .from('siop_staging_rows')
            .where('id', r.id)
            .update({
              normalized_cnj: validation.cnj ?? null,
              normalized_debtor_key: validation.debtorKey ?? null,
              normalized_value: validation.value,
              normalized_year: validation.year,
              validation_status: validation.status,
              errors: validation.errors ?? null,
            })
        }
      })

      // PASS 3 — consolidate (chunk 1000)
      let cursor: string | null = null
      while (true) {
        const result = await withTenantRls(imp.tenant_id, async (trx) => {
          const q = trx
            .from('siop_staging_rows')
            .where('import_id', importId)
            .andWhere('validation_status', 'valid')
            .whereNull('processed_at')
          if (cursor) q.andWhere('id', '>', cursor)
          const rows = await q.orderBy('id', 'asc').limit(1000)
          if (!rows.length) return { done: true, lastId: null, ins: 0, upd: 0, sk: 0 }

          let ins = 0,
            upd = 0,
            sk = 0
          for (const r of rows) {
            const action = await this.upsertOne(trx, imp.tenant_id, importId, r)
            if (action === 'inserted') ins++
            else if (action === 'updated') upd++
            else sk++
            await trx
              .from('siop_staging_rows')
              .where('id', r.id)
              .update({
                processed_at: trx.knexRawQuery('now()').knexQuery as any,
              })
          }
          return { done: false, lastId: rows[rows.length - 1].id, ins, upd, sk }
        })
        inserted += result.ins
        updatedCount += result.upd
        skipped += result.sk
        if (result.done) break
        cursor = result.lastId
      }

      // contar erros
      const errCount = await db
        .from('siop_staging_rows')
        .where('import_id', importId)
        .andWhere('validation_status', 'invalid')
        .count('* as c')
      errorsCount = Number(errCount[0].c)

      await db
        .from('siop_imports')
        .where('id', importId)
        .update({
          status: errorsCount > 0 ? 'partial' : 'completed',
          finished_at: db.knexRawQuery('now()').knexQuery as any,
          total_rows: totalRows,
          inserted,
          updated: updatedCount,
          skipped,
          errors: errorsCount,
        })
    } catch (err) {
      logger.error({ err, importId }, 'siop:import.failed')
      await db
        .from('siop_imports')
        .where('id', importId)
        .update({
          status: 'failed',
          finished_at: db.knexRawQuery('now()').knexQuery as any,
        })
      throw err
    }
  }

  private rowToObj(row: any): Record<string, any> | null {
    const arr = row.values as any[]
    if (!arr || arr.length < 3) return null
    if (typeof arr[1] === 'string' && /cnj/i.test(arr[1])) return null // header
    return {
      cnj: arr[1],
      devedor: arr[2],
      exercicio: arr[3],
      valor_face: arr[4],
      natureza: arr[5],
      numero_precatorio: arr[6],
    }
  }

  private validateRow(raw: Record<string, any>): {
    cnj: string | null
    debtorKey: string | null
    value: number | null
    year: number | null
    status: 'valid' | 'invalid' | 'warning'
    errors: any[] | null
  } {
    const errors: any[] = []
    const cnjRaw = String(raw.cnj ?? '')
    if (!isValidCnj(cnjRaw)) errors.push({ field: 'cnj', message: 'invalid_cnj' })
    const cnj = isValidCnj(cnjRaw) ? parseCnj(cnjRaw).normalized : null

    const debtor = raw.devedor ? normalizeDebtor(String(raw.devedor)) : null
    if (!debtor) errors.push({ field: 'devedor', message: 'missing' })

    const value = parseValue(raw.valor_face)
    if (value === null) errors.push({ field: 'valor_face', message: 'invalid_value' })

    const year = Number(raw.exercicio)
    if (!Number.isFinite(year) || year < 2000)
      errors.push({ field: 'exercicio', message: 'invalid_year' })

    const status = errors.length === 0 ? 'valid' : 'invalid'
    return {
      cnj,
      debtorKey: debtor?.normalizedKey ?? null,
      value,
      year: Number.isFinite(year) ? year : null,
      status,
      errors: errors.length ? errors : null,
    }
  }

  private async upsertOne(
    trx: any,
    tenantId: string,
    importId: string,
    staging: any
  ): Promise<'inserted' | 'updated' | 'skipped'> {
    const debtor = normalizeDebtor(String(staging.raw_data.devedor))
    // upsert debtor
    let debtorRow = await trx
      .from('debtors')
      .where('tenant_id', tenantId)
      .andWhere('debtor_type', debtor.debtorType)
      .andWhere('normalized_key', debtor.normalizedKey)
      .first()
    if (!debtorRow) {
      const [created] = await trx
        .from('debtors')
        .insert({
          tenant_id: tenantId,
          name: String(staging.raw_data.devedor),
          normalized_name: debtor.normalizedName,
          normalized_key: debtor.normalizedKey,
          debtor_type: debtor.debtorType,
        })
        .returning('id')
      debtorRow = { id: created.id }
    }

    // match cascade
    const externalId = String(staging.raw_data.numero_precatorio ?? '') || null
    const cnj = staging.normalized_cnj
    const fingerprint = createHash('sha256')
      .update(
        `${cnj}|${debtor.normalizedKey}|${staging.normalized_value}|${staging.normalized_year}|${externalId}`
      )
      .digest('hex')

    let asset = null
    if (externalId) {
      asset = await trx
        .from('precatorio_assets')
        .where('tenant_id', tenantId)
        .andWhere('source', 'siop')
        .andWhere('external_id', externalId)
        .first()
    }
    if (!asset && cnj) {
      asset = await trx
        .from('precatorio_assets')
        .where('tenant_id', tenantId)
        .andWhere('source', 'siop')
        .andWhere('cnj_number', cnj)
        .first()
    }
    if (!asset) {
      asset = await trx
        .from('precatorio_assets')
        .where('tenant_id', tenantId)
        .andWhere('source', 'siop')
        .andWhere('row_fingerprint', fingerprint)
        .first()
    }

    let action: 'inserted' | 'updated' | 'skipped'
    if (!asset) {
      const [created] = await trx
        .from('precatorio_assets')
        .insert({
          tenant_id: tenantId,
          source: 'siop',
          external_id: externalId,
          cnj_number: cnj,
          debtor_id: debtorRow.id,
          asset_number: externalId,
          exercise_year: staging.normalized_year,
          nature: this.parseNature(staging.raw_data.natureza),
          face_value: staging.normalized_value,
          lifecycle_status: 'discovered',
          pii_status: 'none',
          compliance_status: 'pending',
          raw_data: staging.raw_data,
          row_fingerprint: fingerprint,
          source_record_id: null,
        })
        .returning('id')
      asset = { id: created.id }
      action = 'inserted'
    } else {
      // update preserva campos manuais
      await trx
        .from('precatorio_assets')
        .where('id', asset.id)
        .update({
          debtor_id: debtorRow.id,
          face_value: staging.normalized_value,
          nature: this.parseNature(staging.raw_data.natureza),
          raw_data: staging.raw_data,
        })
      action = 'updated'
    }

    // asset_event idempotency
    const eventType = action === 'inserted' ? 'siop_imported' : 'siop_updated'
    const idempotencyKey = `${importId}|${staging.id}|${fingerprint}`
    await trx
      .from('asset_events')
      .insert({
        tenant_id: tenantId,
        asset_id: asset.id,
        event_type: eventType,
        source: 'siop',
        payload: { import_id: importId, staging_row_id: staging.id },
        idempotency_key: idempotencyKey,
      })
      .onConflict(['tenant_id', 'asset_id', 'event_type', 'idempotency_key'])
      .ignore()

    return action
  }

  private parseNature(raw: any): 'alimentar' | 'comum' | 'tributario' | 'unknown' {
    const s = String(raw ?? '').toLowerCase()
    if (s.includes('alimentar')) return 'alimentar'
    if (s.includes('comum')) return 'comum'
    if (s.includes('tribut')) return 'tributario'
    return 'unknown'
  }
}

export default new SiopImportService()
```

- [ ] **Step 4: Run passing**

```bash
pnpm test --files="tests/integration/modules/siop/siop_import_service.spec.ts"
```

> Se a fixture XLSX ainda não existe, criar uma mínima manualmente ou via script `scripts/generate_fixture_siop.ts` (
> Task 80).

- [ ] **Step 5: Commit**

```bash
git add app/modules/siop/services/siop_import_service.ts tests/integration/modules/siop/siop_import_service.spec.ts
git commit -m "🚀 feat(siop): SiopImportService with chunked pipeline, advisory lock, match cascade"
```

---

### Task 39: SiopImportHandler + registrar no bootWorkers

**Files:**

- Create: `app/modules/siop/jobs/siop_import_handler.ts`
- Modify: `start/jobs.ts`

- [ ] **Step 1: Handler**

```typescript
// app/modules/siop/jobs/siop_import_handler.ts
import type { Processor } from 'bullmq'
import TenantContext from '#shared/helpers/tenant_context'
import siopImportService from '#modules/siop/services/siop_import_service'
import jobRunService from '#shared/services/job_run_service'

const handler: Processor = async (job) => {
  const { importId, tenantId, requestId, runNumber, parentRunId } = job.data
  const runId = await jobRunService.start({
    tenantId,
    jobName: 'siop:import',
    queueName: 'siop:import',
    bullmqJobId: job.id!,
    bullmqAttempt: job.attemptsMade + 1,
    runNumber: runNumber ?? 1,
    parentRunId: parentRunId ?? undefined,
    targetType: 'siop_import',
    targetId: importId,
    origin: parentRunId ? 'manual_retry' : 'http',
    requestId,
  })

  try {
    const result = await TenantContext.run(tenantId, async () => {
      const locked = await siopImportService.tryLock(importId)
      if (!locked) {
        return { status: 'skipped' as const, reason: 'already_running' }
      }
      await siopImportService.run(importId)
      return { status: 'completed' as const }
    })

    if (result.status === 'skipped') {
      await jobRunService.skip(runId, result.reason)
    } else {
      await jobRunService.complete(runId)
    }
  } catch (err) {
    await jobRunService.fail(runId, err)
    throw err
  }
}

export default handler
```

- [ ] **Step 2: Registrar em start/jobs.ts**

```typescript
// start/jobs.ts (atualizar bootWorkers)
import siopImportHandler from '#modules/siop/jobs/siop_import_handler'

export async function bootWorkers() {
  queueService.registerWorker(
    queues.siopImport.name,
    siopImportHandler,
    queues.siopImport.concurrency
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/modules/siop/jobs/siop_import_handler.ts start/jobs.ts
git commit -m "🚀 feat(siop): siop_import_handler + register in bootWorkers"
```

---

## Phase 15 — SIOP Import Controller & UI

### Task 40: ImportController (upload + show + reprocess + errors + download)

**Files:**

- Create: `app/modules/siop/controllers/import_controller.ts`
- Create: `app/modules/siop/validators/upload_validator.ts`
- Create: `app/modules/siop/routes.ts`

- [ ] **Step 1: Validator**

```typescript
// app/modules/siop/validators/upload_validator.ts
import vine from '@vinejs/vine'

export const uploadValidator = vine.compile(
  vine.object({
    file: vine.file({
      size: '50mb',
      extnames: ['xlsx', 'xls', 'csv'],
    }),
    exercise_year: vine
      .number()
      .min(2000)
      .max(new Date().getFullYear() + 1),
  })
)
```

- [ ] **Step 2: Controller**

```typescript
// app/modules/siop/controllers/import_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import { createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import { stat } from 'node:fs/promises'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import queueService from '#shared/services/queue_service'
import siopImportService from '#modules/siop/services/siop_import_service'
import auditService from '#shared/services/audit_service'
import { uploadValidator } from '#modules/siop/validators/upload_validator'

export default class ImportController {
  async index(ctx: HttpContext) {
    const imports = await db
      .from('siop_imports')
      .where('tenant_id', ctx.tenant.id)
      .orderBy('created_at', 'desc')
      .limit(50)
    return ctx.inertia.render('imports/index', { imports })
  }

  async newForm(ctx: HttpContext) {
    return ctx.inertia.render('imports/new')
  }

  async store(ctx: HttpContext) {
    const { file, exercise_year } = await ctx.request.validateUsing(uploadValidator)
    const checksum = await this.computeChecksum(file.tmpPath!)
    const storedKey = `siop/${ctx.tenant.id}/${exercise_year}/${checksum}-${file.clientName}`
    await drive.use().moveFromDisk(file.tmpPath!, storedKey)

    const { size } = await stat(file.tmpPath ?? storedKey).catch(() => ({ size: 0 }) as any)

    let importId: string
    try {
      importId = await siopImportService.createImport({
        tenantId: ctx.tenant.id,
        filePath: storedKey,
        exerciseYear: exercise_year,
        checksum,
        uploadedByUserId: ctx.auth.user!.id,
        originalFilename: file.clientName,
        mimeType: file.headers['content-type'],
        fileSizeBytes: size || file.size,
      })
    } catch (e: any) {
      if (e?.code === 'E_IMPORT_ALREADY_EXISTS') {
        ctx.session.flash('error', 'Este arquivo já foi importado.')
        return ctx.response.redirect(`/imports/${e.importId}`)
      }
      throw e
    }

    await queueService.getQueue('siop:import').add(
      'siop:import',
      {
        importId,
        tenantId: ctx.tenant.id,
        requestId: ctx.requestId,
      },
      { jobId: `siop:import:${ctx.tenant.id}:${importId}` }
    )

    await auditService.record({
      tenantId: ctx.tenant.id,
      actorUserId: ctx.auth.user!.id,
      entityType: 'siop_import',
      entityId: importId,
      action: 'siop_import_created',
      payload: { exercise_year, checksum_prefix: checksum.slice(0, 8) },
      ipAddress: ctx.request.ip(),
      userAgent: ctx.request.header('user-agent'),
      requestId: ctx.requestId,
    })

    return ctx.response.redirect(`/imports/${importId}`)
  }

  async show(ctx: HttpContext) {
    const imp = await db
      .from('siop_imports')
      .where('id', ctx.params.id)
      .andWhere('tenant_id', ctx.tenant.id)
      .first()
    if (!imp) return ctx.response.notFound()
    return ctx.inertia.render('imports/show', { import: imp })
  }

  async errors(ctx: HttpContext) {
    const imp = await db
      .from('siop_imports')
      .where('id', ctx.params.id)
      .andWhere('tenant_id', ctx.tenant.id)
      .first()
    if (!imp) return ctx.response.notFound()
    const page = Number(ctx.request.qs().page) || 1
    const errors = await db
      .from('siop_staging_rows')
      .where('import_id', imp.id)
      .andWhere('validation_status', 'invalid')
      .orderBy('id', 'asc')
      .paginate(page, 50)
    return ctx.inertia.render('imports/errors', { import: imp, errors: errors.toJSON() })
  }

  async reprocess(ctx: HttpContext) {
    const imp = await db
      .from('siop_imports')
      .where('id', ctx.params.id)
      .andWhere('tenant_id', ctx.tenant.id)
      .first()
    if (!imp) return ctx.response.notFound()
    if (!['failed', 'partial'].includes(imp.status)) {
      return ctx.response.unprocessableEntity({ error: { code: 'E_INVALID_STATE' } })
    }
    const runNumber =
      (
        await db
          .from('radar_job_runs')
          .where('target_type', 'siop_import')
          .andWhere('target_id', imp.id)
          .max('run_number as max_run')
          .first()
      )?.max_run ?? 0
    await queueService.getQueue('siop:import').add(
      'siop:import',
      {
        importId: imp.id,
        tenantId: ctx.tenant.id,
        requestId: ctx.requestId,
        runNumber: runNumber + 1,
        parentRunId: null,
      },
      { jobId: `siop:import:${ctx.tenant.id}:${imp.id}:retry-${runNumber + 1}` }
    )
    return ctx.response.redirect(`/imports/${imp.id}`)
  }

  async downloadSource(ctx: HttpContext) {
    const imp = await db
      .from('siop_imports as i')
      .join('source_records as s', 's.id', 'i.source_record_id')
      .where('i.id', ctx.params.id)
      .andWhere('i.tenant_id', ctx.tenant.id)
      .select('s.source_file_path', 's.original_filename')
      .first()
    if (!imp) return ctx.response.notFound()
    await auditService.record({
      tenantId: ctx.tenant.id,
      actorUserId: ctx.auth.user!.id,
      entityType: 'siop_import',
      entityId: ctx.params.id,
      action: 'source_downloaded',
      ipAddress: ctx.request.ip(),
      userAgent: ctx.request.header('user-agent'),
      requestId: ctx.requestId,
    })
    return ctx.response.attachment(imp.source_file_path, imp.original_filename)
  }

  private async computeChecksum(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = createReadStream(path)
      const hash = createHash('sha256')
      stream.on('data', (c) => hash.update(c))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }
}
```

- [ ] **Step 3: Routes**

```typescript
// app/modules/siop/routes.ts
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const ImportController = () => import('#modules/siop/controllers/import_controller')

router
  .group(() => {
    router.get('/', [ImportController, 'index']).as('imports.index')
    router
      .get('/new', [ImportController, 'newForm'])
      .as('imports.new')
      .use(middleware.permission({ permission: 'imports.create' }))
    router
      .post('/', [ImportController, 'store'])
      .as('imports.store')
      .use(middleware.permission({ permission: 'imports.create' }))
    router.get('/:id', [ImportController, 'show']).as('imports.show')
    router.get('/:id/errors', [ImportController, 'errors']).as('imports.errors')
    router
      .post('/:id/reprocess', [ImportController, 'reprocess'])
      .as('imports.reprocess')
      .use(middleware.permission({ permission: 'imports.reprocess' }))
    router
      .get('/:id/download-source', [ImportController, 'downloadSource'])
      .as('imports.download_source')
      .use(middleware.permission({ permission: 'imports.download_source' }))
  })
  .prefix('/imports')
  .use([middleware.auth(), middleware.tenant()])
```

- [ ] **Step 4: Importar em start/routes.ts**

```typescript
import '#modules/siop/routes'
```

- [ ] **Step 5: Commit**

```bash
git add app/modules/siop/{controllers,routes.ts,validators} start/routes.ts
git commit -m "🚀 feat(siop): import controller (upload, show, errors, reprocess, download)"
```

---

### Task 41: Inertia pages — imports/{index, new, show, errors}

**Files:**

- Create: `inertia/pages/imports/{index,new,show,errors}.tsx`
- Create: `inertia/hooks/use_import_polling.ts`

- [ ] **Step 1: Hook de polling**

```typescript
// inertia/hooks/use_import_polling.ts
import { useEffect, useState } from 'react'
import { router } from '@inertiajs/react'

const FINAL_STATES = ['completed', 'partial', 'failed']

export function useImportPolling(importId: string, currentStatus: string) {
  const [backoff, setBackoff] = useState(3000)

  useEffect(() => {
    if (FINAL_STATES.includes(currentStatus)) return

    let cancelled = false

    const tick = async () => {
      if (cancelled || document.hidden) return
      try {
        await router.reload({ only: ['import'] })
        setBackoff(3000)
      } catch {
        setBackoff((b) => Math.min(b * 2, 60000))
      }
    }

    const interval = setInterval(tick, backoff)
    const onVis = () => {
      if (!document.hidden) tick()
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [importId, currentStatus, backoff])
}
```

- [ ] **Step 2: imports/index.tsx**

```typescript
// inertia/pages/imports/index.tsx
import {Head, Link} from '@inertiajs/react'

interface Imp {
  id: string;
  exercise_year: number;
  status: string;
  total_rows: number
  inserted: number;
  errors: number;
  created_at: string
}

export default function ImportsIndex({imports}: { imports: Imp[] }) {
  return (
    <>
      <Head title = "Imports" / >
      <main>
        <h1>Imports < /h1>
      < Link
  href = "/imports/new" > <button>Novo
  import
  </button></
  Link >
  <table>
    <thead>
      <tr><th>ID < /th><th>Exercício</
  th > <th>Status < /th><th>Rows</
  th > <th>Inseridos < /th><th>Erros</
  th > <th>Criado
  em < /th></
  tr >
  </thead>
  < tbody >
  {
    imports.map((i) => (
      <tr key = {i.id} >
      <td><Link href = {`/imports/${i.id}`
  } > {i.id.slice(0, 8)} < /Link></
  td >
  <td>{i.exercise_year} < /td><td>{i.status}</
  td > <td>{i.total_rows} < /td>
  < td > {i.inserted} < /td><td>{i.errors}</
  td > <td>{new Date(i.created_at).toLocaleString('pt-BR')} < /td>
  < /tr>
))
}
  </tbody>
  < /table>
  < /main>
  < />
)
}
```

- [ ] **Step 3: imports/new.tsx**

```typescript
// inertia/pages/imports/new.tsx
import {Head, useForm} from '@inertiajs/react'

export default function ImportsNew() {
  const form = useForm<{ file: File | null; exercise_year: number }>({
    file: null,
    exercise_year: new Date().getFullYear()
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    form.post('/imports', {forceFormData: true})
  }

  return (
    <>
      <Head title = "Novo import" / >
      <main>
        <h1>Novo
  import SIOP
  </h1>
  < form
  onSubmit = {submit} >
    <label>Arquivo
  XLSX / CSV
  < input
  type = "file"
  required
  onChange = {(e)
=>
  form.setData('file', e.target.files?.[0] ?? null)
}
  />
  < /label>
  < label > Exercício
  < input
  type = "number"
  min = {2000}
  max = {2030}
  required
  value = {form.data.exercise_year}
  onChange = {(e)
=>
  form.setData('exercise_year', Number(e.target.value))
}
  />
  < /label>
  < button
  type = "submit"
  disabled = {form.processing} > Enviar < /button>
    < /form>
    < /main>
    < />
)
}
```

- [ ] **Step 4: imports/show.tsx**

```typescript
// inertia/pages/imports/show.tsx
import {Head, Link, router} from '@inertiajs/react'
import {useImportPolling} from '~/hooks/use_import_polling'

export default function ImportsShow({import: imp}: { import: any }) {
  useImportPolling(imp.id, imp.status)
  const isFinal = ['completed', 'partial', 'failed'].includes(imp.status)
  return (
    <>
      <Head title = {`Import ${imp.id.slice(0, 8)}`
}
  />
  < main >
  <h1>Import
  {
    imp.id.slice(0, 8)
  } — exercício
  {
    imp.exercise_year
  }
  </h1>
  < p > Status
:
  <strong>{imp.status} < /strong></
  p >
  <ul>
    <li>Total
:
  {
    imp.total_rows
  }
  </li>
  < li > Inseridos
:
  {
    imp.inserted
  }
  </li>
  < li > Atualizados
:
  {
    imp.updated
  }
  </li>
  < li > Pulados
:
  {
    imp.skipped
  }
  </li>
  < li > Erros
:
  {
    imp.errors
  }
  </li>
  < /ul>
  {
    imp.errors > 0 && <Link href = {`/imports/${imp.id}/errors`
  }>
    <button>Ver
    erros({imp.errors}) < /button></
    Link >
  }
  {
    (imp.status === 'failed' || imp.status === 'partial') && (
      <button onClick = {()
  =>
    router.post(`/imports/${imp.id}/reprocess`)
  }>
    Reprocessar < /button>
  )
  }
  <a href = {`/imports/${imp.id}/download-source`
}>
  <button>Baixar
  arquivo
  original < /button></
  a >
  </main>
  < />
)
}
```

- [ ] **Step 5: imports/errors.tsx**

```typescript
// inertia/pages/imports/errors.tsx
import {Head, Link} from '@inertiajs/react'

interface Props {
  import: any
  errors: { data: any[]; meta: any }
}

export default function ImportsErrors({import: imp, errors}: Props) {
  return (
    <>
      <Head title = {`Erros — Import ${imp.id.slice(0, 8)}`
}
  />
  < main >
  <h1>Erros
  do import {imp
.
  id.slice(0, 8)
}
  </h1>
  < Link
  href = {`/imports/${imp.id}`
}>
  Voltar < /Link>
  < table >
  <thead><tr><th>Linha(id) < /th><th>CNJ</
  th > <th>Erros < /th></
  tr > </thead>
  < tbody >
  {
    errors.data.map((r) => (
      <tr key = {r.id} >
        <td>{r.id.slice(0, 8)} < /td>
        < td > {r.normalized_cnj ?? '-'} < /td>
        < td > <pre>{JSON.stringify(r.errors, null, 2)} < /pre></td >
  </tr>
))
}
  </tbody>
  < /table>
  < /main>
  < />
)
}
```

- [ ] **Step 6: Smoke test**

```bash
pnpm dev &
sleep 5
# (manual: navegar pra /auth/login, logar, ir em /imports)
kill %1
```

- [ ] **Step 7: Commit**

```bash
git add inertia/pages/imports/ inertia/hooks/use_import_polling.ts
git commit -m "🚀 feat(siop ui): imports index/new/show/errors pages with polling hook"
```

---

## Phase 16 — Precatórios list & detail

### Task 42: PrecatorioRepository com whitelist sort/filter

**Files:**

- Create: `app/modules/precatorios/repositories/precatorio_repository.ts`
- Create: `tests/integration/modules/precatorios/precatorio_repository.spec.ts`

- [ ] **Step 1: Test (com fixture)**

```typescript
// tests/integration/modules/precatorios/precatorio_repository.spec.ts
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import precatorioRepository from '#modules/precatorios/repositories/precatorio_repository'

test.group('PrecatorioRepository', (group) => {
  let tenantA: string
  let tenantB: string

  group.each.setup(async () => {
    const [a] = await db
      .from('tenants')
      .insert({
        name: 'A',
        slug: `a-${Date.now()}`,
        status: 'active',
        rbac_version: 1,
      })
      .returning('id')
    const [b] = await db
      .from('tenants')
      .insert({
        name: 'B',
        slug: `b-${Date.now()}`,
        status: 'active',
        rbac_version: 1,
      })
      .returning('id')
    tenantA = a.id
    tenantB = b.id
    await db.from('precatorio_assets').insert([
      {
        tenant_id: tenantA,
        source: 'siop',
        cnj_number: '00012345620234036100',
        face_value: 100000,
        lifecycle_status: 'expedited',
        exercise_year: 2024,
        nature: 'alimentar',
        pii_status: 'none',
        compliance_status: 'pending',
      },
      {
        tenant_id: tenantA,
        source: 'siop',
        cnj_number: '00012345620234036101',
        face_value: 50000,
        lifecycle_status: 'paid',
        exercise_year: 2023,
        nature: 'comum',
        pii_status: 'none',
        compliance_status: 'pending',
      },
      {
        tenant_id: tenantB,
        source: 'siop',
        cnj_number: '00012345620234036102',
        face_value: 999,
        lifecycle_status: 'expedited',
        exercise_year: 2024,
        nature: 'alimentar',
        pii_status: 'none',
        compliance_status: 'pending',
      },
    ])
  })

  test('list filters by tenant', async ({ assert }) => {
    const r = await precatorioRepository.list(tenantA, { page: 1, perPage: 10 })
    assert.equal(r.meta.total, 2)
    for (const row of r.data) assert.equal(row.tenant_id, tenantA)
  })

  test('list filters by lifecycle_status', async ({ assert }) => {
    const r = await precatorioRepository.list(tenantA, {
      page: 1,
      perPage: 10,
      filters: { lifecycle_status: ['expedited'] },
    })
    assert.equal(r.meta.total, 1)
    assert.equal(r.data[0].lifecycle_status, 'expedited')
  })

  test('list rejects sort outside whitelist', async ({ assert }) => {
    await assert.rejects(
      () =>
        precatorioRepository.list(tenantA, {
          page: 1,
          perPage: 10,
          sortBy: 'random_col' as any,
          sortDir: 'asc',
        }),
      /sort_not_allowed/i
    )
  })

  test('list sorts by face_value desc', async ({ assert }) => {
    const r = await precatorioRepository.list(tenantA, {
      page: 1,
      perPage: 10,
      sortBy: 'face_value',
      sortDir: 'desc',
    })
    assert.isAtLeast(Number(r.data[0].face_value), Number(r.data[1].face_value))
  })
})
```

- [ ] **Step 2: Run failing**

- [ ] **Step 3: Implement**

```typescript
// app/modules/precatorios/repositories/precatorio_repository.ts
import db from '@adonisjs/lucid/services/db'

export const SORTABLE_COLUMNS = [
  'created_at',
  'face_value',
  'estimated_updated_value',
  'exercise_year',
  'lifecycle_status',
  'nature',
  'base_date',
] as const

export type SortableColumn = (typeof SORTABLE_COLUMNS)[number]

export interface ListParams {
  page?: number
  perPage?: number
  search?: string
  filters?: {
    debtor_id?: string
    exercise_year?: number[]
    lifecycle_status?: string[]
    nature?: string[]
    face_value_min?: number
    face_value_max?: number
  }
  sortBy?: SortableColumn
  sortDir?: 'asc' | 'desc'
}

class PrecatorioRepository {
  async list(tenantId: string, params: ListParams) {
    if (params.sortBy && !SORTABLE_COLUMNS.includes(params.sortBy)) {
      throw Object.assign(new Error('sort_not_allowed'), { code: 'E_VALIDATION_ERROR' })
    }
    const q = db
      .from('precatorio_assets as pa')
      .leftJoin('debtors as d', 'd.id', 'pa.debtor_id')
      .where('pa.tenant_id', tenantId)
      .whereNull('pa.deleted_at')
      .select('pa.*', 'd.name as debtor_name')

    if (params.search) {
      q.where((w) =>
        w
          .where('pa.cnj_number', 'like', `%${params.search}%`)
          .orWhere('d.name', 'ilike', `%${params.search}%`)
      )
    }
    const f = params.filters ?? {}
    if (f.debtor_id) q.where('pa.debtor_id', f.debtor_id)
    if (f.exercise_year?.length) q.whereIn('pa.exercise_year', f.exercise_year)
    if (f.lifecycle_status?.length) q.whereIn('pa.lifecycle_status', f.lifecycle_status)
    if (f.nature?.length) q.whereIn('pa.nature', f.nature)
    if (f.face_value_min !== undefined) q.where('pa.face_value', '>=', f.face_value_min)
    if (f.face_value_max !== undefined) q.where('pa.face_value', '<=', f.face_value_max)

    q.orderBy(`pa.${params.sortBy ?? 'created_at'}`, params.sortDir ?? 'desc')

    const result = await q.paginate(params.page ?? 1, params.perPage ?? 25)
    return result.toJSON()
  }

  async findById(tenantId: string, id: string) {
    return db
      .from('precatorio_assets')
      .where('tenant_id', tenantId)
      .andWhere('id', id)
      .whereNull('deleted_at')
      .first()
  }

  async listEvents(tenantId: string, assetId: string) {
    return db
      .from('asset_events')
      .where('tenant_id', tenantId)
      .andWhere('asset_id', assetId)
      .orderBy('created_at', 'desc')
      .limit(200)
  }
}

export default new PrecatorioRepository()
```

- [ ] **Step 4: Run passing & commit**

```bash
pnpm test --files="tests/integration/modules/precatorios/precatorio_repository.spec.ts"
git add app/modules/precatorios/repositories/precatorio_repository.ts tests/integration/modules/precatorios/precatorio_repository.spec.ts
git commit -m "🚀 feat(precatorios): repository with sort whitelist + tenant scope tests"
```

---

### Task 43: PrecatorioController + routes

**Files:**

- Create: `app/modules/precatorios/controllers/precatorios_controller.ts`
- Create: `app/modules/precatorios/routes.ts`

- [ ] **Step 1: Controller**

```typescript
// app/modules/precatorios/controllers/precatorios_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import precatorioRepository, {
  SORTABLE_COLUMNS,
} from '#modules/precatorios/repositories/precatorio_repository'

export default class PrecatoriosController {
  async index(ctx: HttpContext) {
    const qs = ctx.request.qs()
    const sortBy = SORTABLE_COLUMNS.includes(qs.sort_by) ? qs.sort_by : 'created_at'
    const result = await precatorioRepository.list(ctx.tenant.id, {
      page: Number(qs.page) || 1,
      perPage: Math.min(Number(qs.per_page) || 25, 100),
      search: qs.search,
      sortBy: sortBy as any,
      sortDir: qs.sort_dir === 'asc' ? 'asc' : 'desc',
      filters: {
        debtor_id: qs.debtor_id,
        exercise_year: qs.exercise_year ? [].concat(qs.exercise_year).map(Number) : undefined,
        lifecycle_status: qs.lifecycle_status ? [].concat(qs.lifecycle_status) : undefined,
        nature: qs.nature ? [].concat(qs.nature) : undefined,
        face_value_min: qs.face_value_min ? Number(qs.face_value_min) : undefined,
        face_value_max: qs.face_value_max ? Number(qs.face_value_max) : undefined,
      },
    })
    return ctx.inertia.render('precatorios/index', { precatorios: result, qs })
  }

  async show(ctx: HttpContext) {
    const asset = await precatorioRepository.findById(ctx.tenant.id, ctx.params.id)
    if (!asset) return ctx.response.notFound()
    const events = await precatorioRepository.listEvents(ctx.tenant.id, asset.id)
    return ctx.inertia.render('precatorios/show', { asset, events })
  }
}
```

- [ ] **Step 2: Routes**

```typescript
// app/modules/precatorios/routes.ts
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const PrecatoriosController = () =>
  import('#modules/precatorios/controllers/precatorios_controller')

router
  .group(() => {
    router.get('/', [PrecatoriosController, 'index']).as('precatorios.index')
    router.get('/:id', [PrecatoriosController, 'show']).as('precatorios.show')
  })
  .prefix('/precatorios')
  .use([
    middleware.auth(),
    middleware.tenant(),
    middleware.permission({ permission: 'precatorios.read' }),
  ])
```

- [ ] **Step 3: Importar em start/routes.ts e commit**

```typescript
import '#modules/precatorios/routes'
```

```bash
git add app/modules/precatorios/{controllers,routes.ts} start/routes.ts
git commit -m "🚀 feat(precatorios): list and detail controllers"
```

---

### Task 44: Inertia pages — precatorios/{index, show}

**Files:**

- Create: `inertia/pages/precatorios/{index,show}.tsx`

- [ ] **Step 1: index**

```typescript
// inertia/pages/precatorios/index.tsx
import {Head, Link, router} from '@inertiajs/react'
import {useState} from 'react'

interface Asset {
  id: string;
  cnj_number: string;
  debtor_name: string;
  exercise_year: number
  nature: string;
  face_value: string;
  lifecycle_status: string;
  compliance_status: string
}

interface Props {
  precatorios: { data: Asset[]; meta: any }
  qs: any
}

export default function PrecatoriosIndex({precatorios, qs}: Props) {
  const [search, setSearch] = useState(qs.search ?? '')

  function applyFilter() {
    router.get('/precatorios', {...qs, search, page: 1}, {preserveState: true})
  }

  return (
    <>
      <Head title = "Precatórios" / >
      <main>
        <h1>Precatórios — {
    precatorios.meta.total
  }
  total < /h1>
  < div >
  <input placeholder = "Buscar CNJ ou devedor..."
  value = {search}
  onChange = {(e)
=>
  setSearch(e.target.value)
}
  onBlur = {applyFilter}
  onKeyDown = {(e)
=>
  e.key === 'Enter' && applyFilter()
}
  />
  < /div>
  < table >
  <thead><tr><th>CNJ < /th><th>Devedor</
  th > <th>Exec < /th><th>Nature</
  th > <th>Valor < /th><th>Lifecycle</
  th > <th>Compliance < /th></
  tr > </thead>
  < tbody >
  {
    precatorios.data.map((p) => (
      <tr key = {p.id} >
      <td><Link href = {`/precatorios/${p.id}`
  } > {p.cnj_number ?? p.id.slice(0, 8)} < /Link></
  td >
  <td>{p.debtor_name} < /td><td>{p.exercise_year}</
  td > <td>{p.nature} < /td>
  < td > {
    p
    .face_value ? Number(p.face_value).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : '-'
  } < /td>
  < td > {p.lifecycle_status} < /td><td>{p.compliance_status}</
  td >
  </tr>
))
}
  </tbody>
  < /table>
  < nav >
  {
    precatorios.meta.first_page < precatorios.meta.last_page && (
      <>
        {
          precatorios.meta.current_page > 1 && (
            <button onClick = {()
=>
  router.get('/precatorios', {...qs, page: precatorios.meta.current_page - 1})
}>«</button>
)
}
  <span>Página
  {
    precatorios.meta.current_page
  }
  de
  {
    precatorios.meta.last_page
  }
  </span>
  {
    precatorios.meta.current_page < precatorios.meta.last_page && (
      <button onClick = {()
  =>
    router.get('/precatorios', {...qs, page: precatorios.meta.current_page + 1})
  }>»</button>
  )
  }
  </>
)
}
  </nav>
  < /main>
  < />
)
}
```

- [ ] **Step 2: show**

```typescript
// inertia/pages/precatorios/show.tsx
import {Head, Link} from '@inertiajs/react'

interface Props {
  asset: any;
  events: any[]
}

export default function PrecatorioShow({asset, events}: Props) {
  return (
    <>
      <Head title = {`Precatório ${asset.cnj_number ?? asset.id.slice(0, 8)}`
}
  />
  < main >
  <Link href = "/precatorios" >← Voltar < /Link>
  < h1 > Precatório
  {
    asset.cnj_number ?? '<sem CNJ>'
  }
  </h1>
  < section >
  <h2>Visão
  geral < /h2>
  < ul >
  <li>Source
:
  {
    asset.source
  }
  </li>
  < li > External
  ID: {
    asset.external_id ?? '-'
  }
  </li>
  < li > Exercício
:
  {
    asset.exercise_year ?? '-'
  }
  </li>
  < li > Natureza
:
  {
    asset.nature
  }
  </li>
  < li > Valor
  face: {
    asset.face_value ? Number(asset.face_value).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : '-'
  }
  </li>
  < li > Lifecycle
:
  {
    asset.lifecycle_status
  }
  </li>
  < li > Compliance
:
  {
    asset.compliance_status
  }
  </li>
  < li > PII
  status: {
    asset.pii_status
  }
  </li>
  < /ul>
  < /section>
  < section >
  <h2>Eventos({events.length}) < /h2>
  < ul >
  {
    events.map((e) => (
      <li key = {e.id} >
        <strong>{e.event_type} < /strong> · {new Date(e.event_date).toLocaleString('pt-BR')}
        < /li>
    ))
  }
  < /ul>
  < /section>
  < /main>
  < />
)
}
```

- [ ] **Step 3: Commit**

```bash
git add inertia/pages/precatorios/
git commit -m "🚀 feat(precatorios ui): list page with filters and detail page"
```

---

## Phase 17 — Debtors UI (curto)

### Task 45: DebtorsController + pages

**Files:**

- Create: `app/modules/debtors/controllers/debtors_controller.ts`
- Create: `app/modules/debtors/repositories/debtor_repository.ts`
- Create: `app/modules/debtors/routes.ts`
- Create: `inertia/pages/debtors/{index,show}.tsx`

- [ ] **Step 1: Repository**

```typescript
// app/modules/debtors/repositories/debtor_repository.ts
import db from '@adonisjs/lucid/services/db'

class DebtorRepository {
  async list(tenantId: string, page = 1, perPage = 25) {
    return db
      .from('v_debtor_aggregates')
      .where('tenant_id', tenantId)
      .orderBy('total_face_value', 'desc')
      .paginate(page, perPage)
      .then((r) => r.toJSON())
  }

  async findById(tenantId: string, id: string) {
    return db
      .from('debtors')
      .where('tenant_id', tenantId)
      .andWhere('id', id)
      .whereNull('deleted_at')
      .first()
  }

  async listAssetsByDebtor(tenantId: string, debtorId: string, page = 1, perPage = 25) {
    return db
      .from('precatorio_assets')
      .where('tenant_id', tenantId)
      .andWhere('debtor_id', debtorId)
      .whereNull('deleted_at')
      .orderBy('created_at', 'desc')
      .paginate(page, perPage)
      .then((r) => r.toJSON())
  }
}

export default new DebtorRepository()
```

- [ ] **Step 2: Controller + routes**

```typescript
// app/modules/debtors/controllers/debtors_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import debtorRepository from '#modules/debtors/repositories/debtor_repository'

export default class DebtorsController {
  async index(ctx: HttpContext) {
    const result = await debtorRepository.list(ctx.tenant.id, Number(ctx.request.qs().page) || 1)
    return ctx.inertia.render('debtors/index', { debtors: result })
  }

  async show(ctx: HttpContext) {
    const debtor = await debtorRepository.findById(ctx.tenant.id, ctx.params.id)
    if (!debtor) return ctx.response.notFound()
    const assets = await debtorRepository.listAssetsByDebtor(
      ctx.tenant.id,
      debtor.id,
      Number(ctx.request.qs().page) || 1
    )
    return ctx.inertia.render('debtors/show', { debtor, assets })
  }
}
```

```typescript
// app/modules/debtors/routes.ts
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const DebtorsController = () => import('#modules/debtors/controllers/debtors_controller')

router
  .group(() => {
    router.get('/', [DebtorsController, 'index']).as('debtors.index')
    router.get('/:id', [DebtorsController, 'show']).as('debtors.show')
  })
  .prefix('/debtors')
  .use([
    middleware.auth(),
    middleware.tenant(),
    middleware.permission({ permission: 'precatorios.read' }),
  ])
```

Add to `start/routes.ts`: `import '#modules/debtors/routes'`

- [ ] **Step 3: Pages**

```typescript
// inertia/pages/debtors/index.tsx
import {Head, Link} from '@inertiajs/react'

export default function DebtorsIndex({debtors}: { debtors: any }) {
  return (
    <>
      <Head title = "Devedores" / >
      <main>
        <h1>Devedores < /h1>
      < table >
      <thead><tr><th>Devedor < /th><th>Assets</
  th > <th>Total
  face
  value < /th></
  tr > </thead>
  < tbody >
  {
    debtors.data.map((d: any) => (
      <tr key = {d.debtor_id} >
      <td><Link href = {`/debtors/${d.debtor_id}`
  } > {d.debtor_name} < /Link></
  td >
  <td>{d.asset_count} < /td>
  < td > {Number(d.total_face_value
).
  toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})
}
  </td>
  < /tr>
))
}
  </tbody>
  < /table>
  < /main>
  < />
)
}
```

```typescript
// inertia/pages/debtors/show.tsx
import {Head, Link} from '@inertiajs/react'

export default function DebtorShow({debtor, assets}: any) {
  return (
    <>
      <Head title = {`Devedor ${debtor.name}`
}
  />
  < main >
  <Link href = "/debtors" >← Voltar < /Link>
  < h1 > {debtor.name} < /h1>
  < p > Tipo
:
  {
    debtor.debtor_type
  } · Estado: {
    debtor.state_code ?? '-'
  } · CNPJ: {
    debtor.cnpj ?? '-'
  }
  </p>
  < h2 > Precatórios({assets.meta.total}) < /h2>
  < ul >
  {
    assets.data.map((a: any) => (
      <li key = {a.id} > <Link href = {`/precatorios/${a.id}`
  } > {a.cnj_number ?? a.id.slice(0, 8)} < /Link> — exercício {a.exercise_year}</
  li >
))
}
  </ul>
  < /main>
  < />
)
}
```

- [ ] **Step 4: Commit**

```bash
git add app/modules/debtors/ inertia/pages/debtors/ start/routes.ts
git commit -m "🚀 feat(debtors): list (via materialized view) and detail UI"
```

---

## Phase 18 — Dashboard UI

### Task 46: DashboardController + page

**Files:**

- Create: `app/modules/dashboard/controllers/dashboard_controller.ts`
- Create: `app/modules/dashboard/routes.ts`
- Create: `inertia/pages/dashboard/index.tsx`

- [ ] **Step 1: Controller**

```typescript
// app/modules/dashboard/controllers/dashboard_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class DashboardController {
  async index(ctx: HttpContext) {
    const metrics = await db.from('v_dashboard_metrics').where('tenant_id', ctx.tenant.id).first()

    const yearly = await db
      .from('v_asset_yearly_stats')
      .where('tenant_id', ctx.tenant.id)
      .orderBy('exercise_year', 'asc')

    const topDebtors = await db
      .from('v_debtor_aggregates')
      .where('tenant_id', ctx.tenant.id)
      .orderBy('total_face_value', 'desc')
      .limit(10)

    const recentImports = await db
      .from('siop_imports')
      .where('tenant_id', ctx.tenant.id)
      .orderBy('created_at', 'desc')
      .limit(5)

    return ctx.inertia.render('dashboard/index', {
      metrics: metrics ?? {
        total_assets: 0,
        debtors_count: 0,
        total_face_value: 0,
        expedited_count: 0,
        paid_count: 0,
        new_30d: 0,
      },
      yearly,
      topDebtors,
      recentImports,
    })
  }
}
```

- [ ] **Step 2: Routes**

```typescript
// app/modules/dashboard/routes.ts
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const DashboardController = () => import('#modules/dashboard/controllers/dashboard_controller')

router
  .get('/dashboard', [DashboardController, 'index'])
  .as('dashboard.index')
  .use([middleware.auth(), middleware.tenant()])
```

Add to `start/routes.ts`: `import '#modules/dashboard/routes'`

- [ ] **Step 3: Page (sem ApexCharts ainda — Phase 27 traz polish)**

```typescript
// inertia/pages/dashboard/index.tsx
import {Head} from '@inertiajs/react'

export default function Dashboard({metrics, yearly, topDebtors, recentImports}: any) {
  return (
    <>
      <Head title = "Dashboard" / >
      <main>
        <h1>Dashboard < /h1>
      < div
  style = {
  {
    display: 'grid', gridTemplateColumns
  :
    'repeat(4, 1fr)', gap
  :
    '1rem'
  }
}>
  <div className = "kpi" > <strong>{metrics.total_assets} < /strong><br / > Total
  assets < /div>
  < div
  className = "kpi" > <strong>{metrics.debtors_count} < /strong><br / > Devedores < /div>
    < div
  className = "kpi" > <strong>{metrics.expedited_count} < /strong><br / > Expedidos < /div>
    < div
  className = "kpi" > <strong>{metrics.new_30d} < /strong><br / > Novos(30
  d
)
  </div>
  < /div>
  < h2 > Por
  exercício < /h2>
  < ul > {yearly.map((y: any) => <li key = {y.exercise_year} > {y.exercise_year}
:
  {
    y.count
  }
  ({Number(y.total).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})
})
  </li>)}</u
  l >
  <h2>Top
  devedores < /h2>
  < ul > {topDebtors.map((d: any) => <li key = {d.debtor_id} > {d.debtor_name}
:
  {
    Number(d.total_face_value).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})
  }
  </li>)}</u
  l >
  <h2>Imports
  recentes < /h2>
  < ul > {recentImports.map((i: any) => <li key = {i.id} > {i.exercise_year} — {
    i.status
  }
  ({i.total_rows}
  rows
)
  </li>)}</u
  l >
  </main>
  < />
)
}
```

- [ ] **Step 4: Commit**

```bash
git add app/modules/dashboard/ inertia/pages/dashboard/ start/routes.ts
git commit -m "🚀 feat(dashboard): KPIs, yearly stats, top debtors, recent imports"
```

---

## Phase 19 — PII Reveal flow

### Task 47: PiiPolicy + RevealService + Controller + RevealDialog

**Files:**

- Create: `app/modules/pii/policies/pii_policy.ts`
- Create: `app/modules/pii/services/reveal_service.ts`
- Create: `app/modules/pii/controllers/reveal_controller.ts`
- Create: `app/modules/pii/routes.ts`
- Create: `inertia/components/pii/reveal_dialog.tsx`
- Create: `inertia/lib/axios_client.ts`

- [ ] **Step 1: RevealService**

```typescript
// app/modules/pii/services/reveal_service.ts
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import { withTenantRls } from '#shared/helpers/with_tenant_rls'

const RATE_LIMIT_PREFIX = 'radar:rl:pii:reveal'
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_S = 3600

class RevealService {
  async checkRate(userId: string): Promise<boolean> {
    const key = `${RATE_LIMIT_PREFIX}:${userId}`
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_S)
    return count <= RATE_LIMIT_MAX
  }

  async reveal(params: {
    tenantId: string
    actorUserId: string
    beneficiaryId: string
    purpose: string
    justification: string
    assetId?: string | null
    ipAddress?: string | null
    userAgent?: string | null
    requestId?: string | null
  }): Promise<{ name: string; document: string; document_type: string }> {
    return withTenantRls(params.tenantId, async (trx) => {
      const result = await trx.rawQuery(
        `
        select * from pii.reveal_beneficiary($1, $2, $3, $4, $5, $6, $7, $8)
      `,
        [
          params.beneficiaryId,
          params.purpose,
          params.justification,
          params.actorUserId,
          params.assetId ?? null,
          params.ipAddress ?? null,
          params.userAgent ?? null,
          params.requestId ?? null,
        ]
      )
      return result.rows[0]
    })
  }
}

export default new RevealService()
```

- [ ] **Step 2: Controller**

```typescript
// app/modules/pii/controllers/reveal_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import permissionCacheService from '#shared/services/permission_cache_service'
import revealService from '#modules/pii/services/reveal_service'

const revealValidator = vine.compile(
  vine.object({
    purpose: vine.string().minLength(3).maxLength(200),
    justification: vine.string().minLength(20).maxLength(1000),
    asset_id: vine.string().uuid().optional(),
  })
)

export default class RevealController {
  async store(ctx: HttpContext) {
    const userId = ctx.auth.user!.id
    const tenantId = ctx.tenant.id
    const beneficiaryId = ctx.params.id

    const hasPerm =
      (await permissionCacheService.userHas(userId, tenantId, 'pii.reveal_masked')) ||
      (await permissionCacheService.userHas(userId, tenantId, 'pii.reveal_full'))
    if (!hasPerm) {
      return ctx.response.forbidden({ error: { code: 'E_PII_REVEAL_FORBIDDEN' } })
    }

    if (!(await revealService.checkRate(userId))) {
      return ctx.response.tooManyRequests({ error: { code: 'E_PII_RATE_LIMIT' } })
    }

    const payload = await ctx.request.validateUsing(revealValidator)
    try {
      const data = await revealService.reveal({
        tenantId,
        actorUserId: userId,
        beneficiaryId,
        purpose: payload.purpose,
        justification: payload.justification,
        assetId: payload.asset_id,
        ipAddress: ctx.request.ip(),
        userAgent: ctx.request.header('user-agent'),
        requestId: ctx.requestId,
      })
      return ctx.response.json(data)
    } catch (err: any) {
      const code = err?.message?.startsWith('E_')
        ? err.message.split(' ')[0]
        : 'E_PII_REVEAL_FORBIDDEN'
      return ctx.response.status(code === 'E_PII_RATE_LIMIT' ? 429 : 403).json({ error: { code } })
    }
  }
}
```

- [ ] **Step 3: Routes**

```typescript
// app/modules/pii/routes.ts
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const RevealController = () => import('#modules/pii/controllers/reveal_controller')

router
  .post('/pii/beneficiaries/:id/reveal', [RevealController, 'store'])
  .as('pii.reveal')
  .use([middleware.auth(), middleware.tenant()])
```

Add to `start/routes.ts`: `import '#modules/pii/routes'`

- [ ] **Step 4: axios_client**

```typescript
// inertia/lib/axios_client.ts
import axios from 'axios'

const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? ''

const client = axios.create({
  baseURL: '/',
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
  headers: { 'X-CSRF-Token': csrfToken },
})

export default client
```

- [ ] **Step 5: RevealDialog**

```typescript
// inertia/components/pii/reveal_dialog.tsx
import {useEffect, useState} from 'react'
import client from '~/lib/axios_client'

interface Props {
  beneficiaryId: string
  assetId?: string
  onClose: () => void
}

export default function RevealDialog({beneficiaryId, assetId, onClose}: Props) {
  const [purpose, setPurpose] = useState('')
  const [justification, setJustification] = useState('')
  const [data, setData] = useState<{ name: string; document: string; document_type: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // auto-clear 90s
  useEffect(() => {
    if (!data) return
    const t = setTimeout(() => {
      setData(null);
      onClose()
    }, 90 * 1000)
    return () => clearTimeout(t)
  }, [data, onClose])

  // visibility hide → limpa
  useEffect(() => {
    function onVis() {
      if (document.hidden) {
        setData(null);
        onClose()
      }
    }

    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [onClose])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true);
    setError(null)
    try {
      const r = await client.post(`/pii/beneficiaries/${beneficiaryId}/reveal`, {
        purpose, justification, asset_id: assetId,
      })
      setData(r.data)
    } catch (e: any) {
      setError(e?.response?.data?.error?.code ?? 'E_INTERNAL')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div role = "dialog"
  style = {
  {
    position: 'fixed', inset
  :
    0, background
  :
    'rgba(0,0,0,0.5)', display
  :
    'flex', alignItems
  :
    'center', justifyContent
  :
    'center'
  }
}>
  <div style = {
  {
    background: '#fff', padding
  :
    '2rem', maxWidth
  :
    500, width
  :
    '100%'
  }
}>
  {
    !data ? (
      <form onSubmit = {submit} >
        <h2>Revelar dados
    do beneficiário < /h2>
    < label > Finalidade < input value = {purpose}
    onChange = {(e)
  =>
    setPurpose(e.target.value)
  }
    required
    minLength = {3}
    /></
    label >
    <label>Justificativa < textarea
    value = {justification}
    onChange = {(e)
  =>
    setJustification(e.target.value)
  }
    required
    minLength = {20}
    /></
    label >
    {error && <p style = {
    {
      color: 'red'
    }
  }>
    Erro: {
      error
    }
    </p>}
    < button
    type = "submit"
    disabled = {loading} > Revelar < /button>
      < button
    type = "button"
    onClick = {onClose} > Cancelar < /button>
      < /form>
  ) :
    (
      <div>
        <h2>Dados
    materializados(auto - clear
    em
    90
    s
  )
    </h2>
    < p > <strong>Nome
  :
    </strong> {data.name}</
    p >
    <p><strong>Documento
  :
    </strong> {data.document}</
    p >
    <button onClick = {()
  =>
    {
      setData(null);
      onClose()
    }
  }>
    Ocultar
    agora < /button>
    < /div>
  )
  }
    </div>
    < /div>
  )
  }
```

- [ ] **Step 6: Commit**

```bash
git add app/modules/pii/ inertia/lib/ inertia/components/pii/ start/routes.ts
git commit -m "🚀 feat(pii): reveal flow with rate limit, audit, one-shot dialog"
```

---

## Phase 20 — Admin

### Task 48: HealthController público + admin/health detalhado

**Files:**

- Create: `app/modules/healthcheck/controllers/healthz_controller.ts`
- Create: `app/modules/admin/controllers/health_controller.ts`
- Create: `app/modules/admin/routes.ts`

- [ ] **Step 1: Healthz público**

```typescript
// app/modules/healthcheck/controllers/healthz_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'

export default class HealthzController {
  async index(ctx: HttpContext) {
    const checks = { app: 'ok', db: 'unknown', redis: 'unknown' }
    try {
      await db.rawQuery('select 1')
      checks.db = 'ok'
    } catch {
      checks.db = 'fail'
    }
    try {
      await redis.ping()
      checks.redis = 'ok'
    } catch {
      checks.redis = 'fail'
    }

    let status: 'ok' | 'degraded' | 'down' = 'ok'
    if (checks.db === 'fail') status = 'down'
    else if (checks.redis === 'fail') status = 'degraded'

    return ctx.response.status(status === 'down' ? 503 : 200).json({ status, checks })
  }
}
```

Adicionar em `start/routes.ts`:

```typescript
import router from '@adonisjs/core/services/router'

const HealthzController = () => import('#modules/healthcheck/controllers/healthz_controller')
router.get('/healthz', [HealthzController, 'index'])
```

- [ ] **Step 2: Admin health detalhado**

```typescript
// app/modules/admin/controllers/health_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import queueService from '#shared/services/queue_service'
import env from '#start/env'
import { queues } from '#start/jobs'

export default class HealthController {
  async detail(ctx: HttpContext) {
    const dbStart = Date.now()
    let dbOk = false
    try {
      await db.rawQuery('select 1')
      dbOk = true
    } catch {}
    const dbLatency = Date.now() - dbStart

    const redisStart = Date.now()
    let redisOk = false
    try {
      await redis.ping()
      redisOk = true
    } catch {}
    const redisLatency = Date.now() - redisStart

    const queueDepths: Record<string, any> = {}
    for (const q of Object.values(queues)) {
      const queue = queueService.getQueue(q.name)
      const counts = await queue.getJobCounts('active', 'waiting', 'delayed', 'failed')
      queueDepths[q.name] = counts
    }

    const failed24h = await db
      .from('radar_job_runs')
      .where('status', 'failed')
      .andWhere('finished_at', '>', db.knexRawQuery(`now() - interval '24 hours'`).knexQuery)
      .count('* as c')

    const lastFailed = await db
      .from('radar_job_runs')
      .where('status', 'failed')
      .orderBy('finished_at', 'desc')
      .limit(10)
      .select('id', 'job_name', 'error_code', 'finished_at')

    const heartbeats = await db.from('worker_heartbeats').select()

    return ctx.response.json({
      app: {
        version: env.get('APP_VERSION', 'dev'),
        node_version: process.version,
        env: env.get('NODE_ENV'),
        uptime_s: Math.floor(process.uptime()),
      },
      db: { status: dbOk ? 'ok' : 'fail', latency_ms: dbLatency },
      redis: { status: redisOk ? 'ok' : 'fail', latency_ms: redisLatency },
      queues: queueDepths,
      jobs: { failed_24h: Number(failed24h[0].c), last_failed_runs: lastFailed },
      workers: heartbeats.map((h: any) => ({
        worker_id: h.worker_id,
        status: this.workerStatus(h.last_seen_at),
        last_seen_at: h.last_seen_at,
      })),
    })
  }

  async live(ctx: HttpContext) {
    return ctx.response.json({ ok: true })
  }

  async ready(ctx: HttpContext) {
    try {
      await db.rawQuery('select 1')
      await redis.ping()
      return ctx.response.json({ ok: true })
    } catch {
      return ctx.response.status(503).json({ ok: false })
    }
  }

  private workerStatus(lastSeen: Date | string): 'ok' | 'stale' | 'down' {
    const ms = Date.now() - new Date(lastSeen).getTime()
    if (ms < 30 * 1000) return 'ok'
    if (ms < 120 * 1000) return 'stale'
    return 'down'
  }
}
```

- [ ] **Step 3: Admin routes**

```typescript
// app/modules/admin/routes.ts
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const HealthController = () => import('#modules/admin/controllers/health_controller')

router
  .group(() => {
    router
      .get('/health', [HealthController, 'detail'])
      .as('admin.health.detail')
      .use(middleware.permission({ permission: 'admin.jobs.read' }))
    router.get('/health/live', [HealthController, 'live']).as('admin.health.live')
    router.get('/health/ready', [HealthController, 'ready']).as('admin.health.ready')
  })
  .prefix('/admin')
  .use([middleware.auth(), middleware.tenant()])
```

Add to `start/routes.ts`: `import '#modules/admin/routes'`

- [ ] **Step 4: Commit**

```bash
git add app/modules/healthcheck/ app/modules/admin/ start/routes.ts
git commit -m "🚀 feat(admin): /healthz public + /admin/health detail (sanitized)"
```

---

### Task 49: JobsController + retry endpoint

**Files:**

- Create: `app/modules/admin/controllers/jobs_controller.ts`
- Modify: `app/modules/admin/routes.ts`

- [ ] **Step 1: Controller**

```typescript
// app/modules/admin/controllers/jobs_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import queueService from '#shared/services/queue_service'
import auditService from '#shared/services/audit_service'

export default class JobsController {
  async index(ctx: HttpContext) {
    const page = Number(ctx.request.qs().page) || 1
    const result = await db
      .from('radar_job_runs')
      .where('tenant_id', ctx.tenant.id)
      .orderBy('created_at', 'desc')
      .paginate(page, 50)
    return ctx.response.json(result.toJSON())
  }

  async retry(ctx: HttpContext) {
    const run = await db.from('radar_job_runs').where('id', ctx.params.runId).first()
    if (!run) return ctx.response.notFound()
    if (run.tenant_id !== ctx.tenant.id)
      return ctx.response.forbidden({ error: { code: 'E_PERMISSION_DENIED' } })
    if (['running', 'pending'].includes(run.status)) {
      return ctx.response.status(423).json({ error: { code: 'E_INVALID_STATE' } })
    }

    // verifica que target ainda existe (ex: siop_import)
    if (run.target_type === 'siop_import') {
      const t = await db.from('siop_imports').where('id', run.target_id).first()
      if (!t) return ctx.response.notFound()
    }

    const newRunNumber = (run.run_number ?? 1) + 1
    await queueService.getQueue(run.queue_name).add(
      run.job_name,
      {
        ...((run.metadata as any) ?? {}),
        importId: run.target_id,
        tenantId: ctx.tenant.id,
        requestId: ctx.requestId,
        runNumber: newRunNumber,
        parentRunId: run.id,
      },
      { jobId: `${run.job_name}:${ctx.tenant.id}:${run.target_id}:r${newRunNumber}` }
    )

    await auditService.record({
      tenantId: ctx.tenant.id,
      actorUserId: ctx.auth.user!.id,
      entityType: 'radar_job_run',
      entityId: run.id,
      action: 'job_retry',
      payload: {
        run_id: run.id,
        parent_run_id: run.id,
        target_type: run.target_type,
        target_id: run.target_id,
      },
      ipAddress: ctx.request.ip(),
      userAgent: ctx.request.header('user-agent'),
      requestId: ctx.requestId,
    })

    return ctx.response.json({ ok: true })
  }
}
```

- [ ] **Step 2: Adicionar rotas em admin/routes.ts**

Dentro do mesmo grupo `/admin`:

```typescript
const JobsController = () => import('#modules/admin/controllers/jobs_controller')
router
  .get('/jobs', [JobsController, 'index'])
  .as('admin.jobs.index')
  .use(middleware.permission({ permission: 'admin.jobs.read' }))
router
  .post('/jobs/:runId/retry', [JobsController, 'retry'])
  .as('admin.jobs.retry')
  .use(middleware.permission({ permission: 'admin.jobs.retry' }))
```

- [ ] **Step 3: Commit**

```bash
git add app/modules/admin/
git commit -m "🚀 feat(admin): jobs list + retry endpoint with audit"
```

---

## Phase 21 — Exports

### Task 50: ExportsController + Handler

**Files:**

- Create: `app/modules/exports/controllers/exports_controller.ts`
- Create: `app/modules/exports/jobs/export_precatorios_handler.ts`
- Create: `app/modules/exports/routes.ts`
- Modify: `start/jobs.ts`

- [ ] **Step 1: Controller**

```typescript
// app/modules/exports/controllers/exports_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import queueService from '#shared/services/queue_service'
import auditService from '#shared/services/audit_service'

const exportValidator = vine.compile(vine.object({ filters: vine.object({}).optional() }))

export default class ExportsController {
  async store(ctx: HttpContext) {
    const { filters } = await ctx.request.validateUsing(exportValidator)
    const [job] = await db
      .from('export_jobs')
      .insert({
        tenant_id: ctx.tenant.id,
        requested_by_user_id: ctx.auth.user!.id,
        type: 'precatorios_csv',
        filters: filters ?? null,
        status: 'pending',
        request_id: ctx.requestId,
      })
      .returning('id')

    await queueService.getQueue('exports:precatorios_csv').add(
      'exports:precatorios_csv',
      {
        exportId: job.id,
        tenantId: ctx.tenant.id,
        requestId: ctx.requestId,
      },
      { jobId: `exports:precatorios_csv:${ctx.tenant.id}:${job.id}` }
    )

    await auditService.record({
      tenantId: ctx.tenant.id,
      actorUserId: ctx.auth.user!.id,
      entityType: 'export_jobs',
      entityId: job.id,
      action: 'precatorios_export_requested',
      payload: { filters, count_estimate: null },
      requestId: ctx.requestId,
    })

    return ctx.response.json({ id: job.id, status: 'pending' })
  }

  async show(ctx: HttpContext) {
    const job = await db
      .from('export_jobs')
      .where('id', ctx.params.id)
      .andWhere('tenant_id', ctx.tenant.id)
      .first()
    if (!job) return ctx.response.notFound()

    let signedUrl = null
    if (job.status === 'completed' && job.output_path) {
      signedUrl = await drive.use().getSignedUrl(job.output_path, { expiresIn: '24 hours' })
    }
    return ctx.response.json({ ...job, signed_url: signedUrl })
  }
}
```

- [ ] **Step 2: Handler**

```typescript
// app/modules/exports/jobs/export_precatorios_handler.ts
import type { Processor } from 'bullmq'
import { Writable } from 'node:stream'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import jobRunService from '#shared/services/job_run_service'

const handler: Processor = async (job) => {
  const { exportId, tenantId, requestId } = job.data
  const runId = await jobRunService.start({
    tenantId,
    jobName: 'exports:precatorios_csv',
    queueName: 'exports:precatorios_csv',
    bullmqJobId: job.id!,
    targetType: 'export_jobs',
    targetId: exportId,
    origin: 'http',
    requestId,
  })

  try {
    await db
      .from('export_jobs')
      .where('id', exportId)
      .update({
        status: 'running',
        started_at: db.knexRawQuery('now()').knexQuery as any,
      })

    const exportRow = await db.from('export_jobs').where('id', exportId).first()
    const filters = (exportRow.filters as any) ?? {}
    const outputKey = `exports/${tenantId}/${exportId}.csv`
    const chunks: string[] = [
      'cnj_number,debtor,exercise_year,nature,face_value,lifecycle_status,compliance_status\n',
    ]

    const q = db
      .from('precatorio_assets as pa')
      .leftJoin('debtors as d', 'd.id', 'pa.debtor_id')
      .where('pa.tenant_id', tenantId)
      .whereNull('pa.deleted_at')
    if (filters.lifecycle_status) q.whereIn('pa.lifecycle_status', filters.lifecycle_status)
    if (filters.exercise_year) q.whereIn('pa.exercise_year', filters.exercise_year)

    let count = 0
    const stream = q
      .select(
        'pa.cnj_number',
        'd.name as debtor',
        'pa.exercise_year',
        'pa.nature',
        'pa.face_value',
        'pa.lifecycle_status',
        'pa.compliance_status'
      )
      .stream()

    for await (const row of stream as any) {
      chunks.push(
        `${row.cnj_number ?? ''},"${(row.debtor ?? '').replace(/"/g, '""')}",${row.exercise_year ?? ''},${row.nature},${row.face_value ?? ''},${row.lifecycle_status},${row.compliance_status}\n`
      )
      count++
    }

    await drive.use().put(outputKey, chunks.join(''))

    await db
      .from('export_jobs')
      .where('id', exportId)
      .update({
        status: 'completed',
        finished_at: db.knexRawQuery('now()').knexQuery as any,
        output_path: outputKey,
        signed_url_expires_at: db.knexRawQuery(`now() + interval '24 hours'`).knexQuery as any,
        row_count: count,
      })
    await jobRunService.complete(runId, { row_count: count })
  } catch (err) {
    await db
      .from('export_jobs')
      .where('id', exportId)
      .update({
        status: 'failed',
        finished_at: db.knexRawQuery('now()').knexQuery as any,
        error_message: (err as any).message,
      })
    await jobRunService.fail(runId, err)
    throw err
  }
}

export default handler
```

- [ ] **Step 3: Routes + register handler**

```typescript
// app/modules/exports/routes.ts
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const ExportsController = () => import('#modules/exports/controllers/exports_controller')

router
  .post('/exports/precatorios', [ExportsController, 'store'])
  .as('exports.precatorios.store')
  .use([
    middleware.auth(),
    middleware.tenant(),
    middleware.permission({ permission: 'exports.create' }),
  ])
router
  .get('/exports/:id', [ExportsController, 'show'])
  .as('exports.show')
  .use([
    middleware.auth(),
    middleware.tenant(),
    middleware.permission({ permission: 'exports.download' }),
  ])
```

Add to `start/routes.ts`: `import '#modules/exports/routes'`

Em `start/jobs.ts`:

```typescript
import exportPrecatoriosHandler from '#modules/exports/jobs/export_precatorios_handler'

queueService.registerWorker(
  queues.exportPrecatorios.name,
  exportPrecatoriosHandler,
  queues.exportPrecatorios.concurrency
)
```

- [ ] **Step 4: Commit**

```bash
git add app/modules/exports/ start/{routes.ts,jobs.ts}
git commit -m "🚀 feat(exports): async precatorios CSV with audit and signed URL"
```

---

## Phase 22 — Maintenance jobs

### Task 51: PurgeStaging + ApplyRetentionPolicy + RefreshAggregates + VacuumHint handlers

**Files:**

- Create: 4 handlers em `app/modules/maintenance/jobs/`
- Modify: `start/jobs.ts`
- Create: `start/scheduler.ts`
- Create: ace commands

- [ ] **Step 1: PurgeStagingHandler**

```typescript
// app/modules/maintenance/jobs/purge_staging_handler.ts
import type { Processor } from 'bullmq'
import db from '@adonisjs/lucid/services/db'
import jobRunService from '#shared/services/job_run_service'

const handler: Processor = async (job) => {
  const runId = await jobRunService.start({
    tenantId: null,
    jobName: 'maintenance:purge_staging',
    queueName: 'maintenance:purge_staging',
    bullmqJobId: job.id!,
    origin: 'scheduler',
  })
  try {
    const result = await db
      .from('siop_staging_rows')
      .where('processed_at', '<', db.knexRawQuery(`now() - interval '90 days'`).knexQuery)
      .delete()
    await jobRunService.complete(runId, { deleted: result })
  } catch (err) {
    await jobRunService.fail(runId, err)
    throw err
  }
}
export default handler
```

- [ ] **Step 2: RefreshAggregatesHandler**

```typescript
// app/modules/maintenance/jobs/refresh_aggregates_handler.ts
import type { Processor } from 'bullmq'
import db from '@adonisjs/lucid/services/db'
import jobRunService from '#shared/services/job_run_service'

const handler: Processor = async (job) => {
  const runId = await jobRunService.start({
    tenantId: null,
    jobName: 'maintenance:refresh_aggregates',
    queueName: 'maintenance:refresh_aggregates',
    bullmqJobId: job.id!,
    origin: 'scheduler',
  })
  try {
    await db.rawQuery('refresh materialized view concurrently v_dashboard_metrics')
    await db.rawQuery('refresh materialized view concurrently v_debtor_aggregates')
    await db.rawQuery('refresh materialized view concurrently v_asset_yearly_stats')
    await jobRunService.complete(runId)
  } catch (err) {
    await jobRunService.fail(runId, err)
    throw err
  }
}
export default handler
```

- [ ] **Step 3: ApplyRetentionPolicyHandler (somente esqueleto/dry-run safe)**

```typescript
// app/modules/maintenance/jobs/apply_retention_policy_handler.ts
import type { Processor } from 'bullmq'
import db from '@adonisjs/lucid/services/db'
import jobRunService from '#shared/services/job_run_service'

const handler: Processor = async (job) => {
  const runId = await jobRunService.start({
    tenantId: null,
    jobName: 'maintenance:apply_retention_policy',
    queueName: 'maintenance:apply_retention_policy',
    bullmqJobId: job.id!,
    origin: 'scheduler',
  })
  try {
    // dry-run default — só registra manifest sem deletar
    const configs = await db.from('retention_config').where('enabled', true)
    for (const cfg of configs) {
      const cutoff = db.knexRawQuery(`now() - interval '${cfg.retention_days} days'`).knexQuery
      // estimar rows que seriam apagadas — não deletar
      // Audit logs e pii.access_logs requerem proteção adicional
      // (este handler só prepara manifest; aplicar retenção real fica para review)
      const tableName = cfg.log_type === 'pii.access_logs' ? null : cfg.log_type
      if (!tableName) continue
      const counts = await db
        .from(tableName)
        .where('created_at', '<', cutoff as any)
        .count('* as c')
      await db.from('retention_manifest').insert({
        log_type: cfg.log_type,
        range_from: '1970-01-01',
        range_to: cutoff as any,
        estimated_rows: Number(counts[0].c),
        status: 'pending',
        created_by: 'system',
      })
    }
    await jobRunService.complete(runId)
  } catch (err) {
    await jobRunService.fail(runId, err)
    throw err
  }
}
export default handler
```

- [ ] **Step 4: VacuumHintHandler**

```typescript
// app/modules/maintenance/jobs/vacuum_hint_handler.ts
import type { Processor } from 'bullmq'
import db from '@adonisjs/lucid/services/db'
import jobRunService from '#shared/services/job_run_service'

const handler: Processor = async (job) => {
  const runId = await jobRunService.start({
    tenantId: null,
    jobName: 'maintenance:vacuum_hint',
    queueName: 'maintenance:vacuum_hint',
    bullmqJobId: job.id!,
    origin: 'scheduler',
  })
  try {
    await db.rawQuery('analyze precatorio_assets')
    await db.rawQuery('analyze asset_events')
    await db.rawQuery('analyze siop_staging_rows')
    await jobRunService.complete(runId)
  } catch (err) {
    await jobRunService.fail(runId, err)
    throw err
  }
}
export default handler
```

- [ ] **Step 5: Registrar todos em start/jobs.ts**

```typescript
import siopImportHandler from '#modules/siop/jobs/siop_import_handler'
import purgeStagingHandler from '#modules/maintenance/jobs/purge_staging_handler'
import refreshAggregatesHandler from '#modules/maintenance/jobs/refresh_aggregates_handler'
import applyRetentionPolicyHandler from '#modules/maintenance/jobs/apply_retention_policy_handler'
import vacuumHintHandler from '#modules/maintenance/jobs/vacuum_hint_handler'
import exportPrecatoriosHandler from '#modules/exports/jobs/export_precatorios_handler'

export async function bootWorkers() {
  queueService.registerWorker(
    queues.siopImport.name,
    siopImportHandler,
    queues.siopImport.concurrency
  )
  queueService.registerWorker(
    queues.purgeStaging.name,
    purgeStagingHandler,
    queues.purgeStaging.concurrency
  )
  queueService.registerWorker(
    queues.refreshAggregates.name,
    refreshAggregatesHandler,
    queues.refreshAggregates.concurrency
  )
  queueService.registerWorker(
    queues.retentionPolicy.name,
    applyRetentionPolicyHandler,
    queues.retentionPolicy.concurrency
  )
  queueService.registerWorker(
    queues.vacuumHint.name,
    vacuumHintHandler,
    queues.vacuumHint.concurrency
  )
  queueService.registerWorker(
    queues.exportPrecatorios.name,
    exportPrecatoriosHandler,
    queues.exportPrecatorios.concurrency
  )
}
```

- [ ] **Step 6: Scheduler**

```typescript
// start/scheduler.ts
import { scheduler } from 'adonisjs-scheduler'
import queueService from '#shared/services/queue_service'

scheduler
  .call(async () => {
    await queueService
      .getQueue('maintenance:refresh_aggregates')
      .add(
        'maintenance:refresh_aggregates',
        {},
        { jobId: `refresh_aggregates:${Math.floor(Date.now() / (15 * 60 * 1000))}` }
      )
  })
  .everyFifteenMinutes()

scheduler
  .call(async () => {
    await queueService.getQueue('maintenance:purge_staging').add('maintenance:purge_staging', {})
  })
  .weeklyOn('Sunday', '03:30')

scheduler
  .call(async () => {
    await queueService
      .getQueue('maintenance:apply_retention_policy')
      .add('maintenance:apply_retention_policy', {})
  })
  .monthlyOn(1, '04:00')

scheduler
  .call(async () => {
    await queueService.getQueue('maintenance:vacuum_hint').add('maintenance:vacuum_hint', {})
  })
  .dailyAt('02:00')
```

Adicionar em `adonisrc.ts` no array `preloads`:

```typescript
() => import('#start/scheduler'),
```

- [ ] **Step 7: Seeder retention_config**

```bash
node ace make:seeder RetentionConfigSeeder
```

```typescript
// database/seeders/retention_config_seeder.ts
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

export default class extends BaseSeeder {
  async run() {
    await db
      .from('retention_config')
      .insert([
        { log_type: 'audit_logs', retention_days: 730, enabled: true },
        { log_type: 'security_audit_logs', retention_days: 730, enabled: true },
        { log_type: 'client_errors', retention_days: 90, enabled: true },
        {
          log_type: 'pii.access_logs',
          retention_days: 1825,
          min_days_for_pii_access_logs: 1825,
          enabled: true,
        },
      ])
      .onConflict('log_type')
      .merge(['updated_at'])
  }
}
```

Add ao index_seeder.

- [ ] **Step 8: Commit**

```bash
git add app/modules/maintenance/ start/jobs.ts start/scheduler.ts adonisrc.ts database/seeders/
git commit -m "🚀 feat(maintenance): purge_staging, refresh_aggregates, retention_policy, vacuum_hint + scheduler"
```

---

## Phase 23 — Frontend errors

### Task 52: ErrorBoundary + /api/client-errors + error pages

**Files:**

- Create: `inertia/components/error_boundary.tsx`
- Create: `inertia/pages/errors/show.tsx`
- Create: `app/modules/client_errors/controllers/client_errors_controller.ts`
- Modify: `inertia/app.tsx`
- Modify: `app/exceptions/handler.ts`

- [ ] **Step 1: ErrorBoundary**

```typescript
// inertia/components/error_boundary.tsx
import {Component} from 'react'

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<React.PropsWithChildren, State> {
  state: State = {hasError: false}

  static getDerivedStateFromError() {
    return {hasError: true}
  }

  componentDidCatch(error: any, info: any) {
    fetch('/api/client-errors', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        message: String(error?.message ?? 'unknown').slice(0, 1024),
        stack: String(error?.stack ?? '').slice(0, 10240),
        componentStack: String(info?.componentStack ?? '').slice(0, 10240),
        url: window.location.href,
      }),
    }).catch(() => {
    })
  }

  render() {
    if (this.state.hasError) {
      return <main><h1>Algo
      deu
      errado < /h1><p>Recarregue a página.</
      p > </main>
    }
    return this.props.children
  }
}
```

- [ ] **Step 2: app.tsx envolve**

Editar `inertia/app.tsx`:

```typescript
import ErrorBoundary from '~/components/error_boundary'
// no createInertiaApp, em setup:
//   return <ErrorBoundary><App {...props} /></ErrorBoundary>
```

(localizar a função `setup` e envolver `<App>` em `<ErrorBoundary>`).

- [ ] **Step 3: client_errors_controller**

```typescript
// app/modules/client_errors/controllers/client_errors_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'

const validator = vine.compile(
  vine.object({
    message: vine.string().maxLength(1024),
    stack: vine.string().maxLength(10240).optional(),
    componentStack: vine.string().maxLength(10240).optional(),
    url: vine.string().maxLength(1024).optional(),
  })
)

const PII_RE =
  /\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|[\w.+-]+@[\w-]+\.[\w-.]+)\b/g

export default class ClientErrorsController {
  async store(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(validator)
    const sanitize = (s: string | undefined) => (s ? s.replace(PII_RE, '<REDACTED>') : null)
    await db.from('client_errors').insert({
      tenant_id: ctx.tenant?.id ?? null,
      user_id: ctx.auth?.user?.id ?? null,
      url: sanitize(data.url),
      message: sanitize(data.message),
      stack: sanitize(data.stack),
      component_stack: sanitize(data.componentStack),
      request_id: ctx.requestId,
      user_agent: ctx.request.header('user-agent'),
      ip_address: ctx.request.ip(),
    })
    return ctx.response.json({ ok: true })
  }
}
```

Add to `start/routes.ts`:

```typescript
const ClientErrorsController = () =>
  import('#modules/client_errors/controllers/client_errors_controller')
router.post('/api/client-errors', [ClientErrorsController, 'store']).as('client_errors.store')
```

- [ ] **Step 4: Error page Inertia**

```typescript
// inertia/pages/errors/show.tsx
import {Head, router} from '@inertiajs/react'

interface Props {
  status: number;
  code?: string;
  message?: string;
  requestId?: string
}

export default function ErrorShow({status, code, message, requestId}: Props) {
  const titles: Record<number, string> = {
    401: 'Sessão necessária', 403: 'Acesso negado',
    404: 'Não encontrado', 419: 'Sessão expirou', 500: 'Erro interno',
  }
  const actions: Record<number, { label: string; onClick: () => void }> = {
    401: {label: 'Entrar novamente', onClick: () => router.visit('/auth/login')},
    403: {label: 'Voltar', onClick: () => history.back()},
    404: {label: 'Ir ao dashboard', onClick: () => router.visit('/dashboard')},
    500: {label: 'Tentar novamente', onClick: () => location.reload()},
  }
  const action = actions[status] ?? actions[500]

  return (
    <>
      <Head title = {`${status} — ${titles[status] ?? 'Erro'}`
}
  />
  < main >
  <h1>{status} — {
    titles[status] ?? 'Erro'
  }
  </h1>
  < p > {message ?? 'Algo deu errado.'
}
  </p>
  {
    code && <p><small>code
  :
    {
      code
    }
    </small></
    p >
  }
  {
    requestId && <p><small>request
  :
    <code>{requestId} < /code></sm
    all > </p>}
    < button
    onClick = {action.onClick} > {action.label} < /button>
      < /main>
      < />
  )
  }
```

- [ ] **Step 5: Atualizar exception handler**

Editar `app/exceptions/handler.ts`:

```typescript
import { HttpExceptionHandler } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'
import { mapCodeToMessage } from '#shared/helpers/error_messages'
import { sanitizeError } from '#shared/helpers/sanitize_error'

export default class HttpExceptionHandler2 extends HttpExceptionHandler {
  protected debug = !app.inProduction

  async handle(error: any, ctx: any) {
    const requestId = ctx.requestId ?? null
    logger.error(
      {
        requestId,
        tenantId: ctx.tenant?.id,
        userId: ctx.auth?.user?.id,
        url: ctx.request.url(),
        method: ctx.request.method(),
        err: sanitizeError(error, { mode: app.inProduction ? 'prod' : 'dev' }),
        code: error?.code,
        status: error?.status,
      },
      'http.request.failed'
    )

    const status = error?.status ?? 500
    const code = error?.code ?? 'E_INTERNAL'
    const message = app.inProduction
      ? mapCodeToMessage(code)
      : (error?.message ?? mapCodeToMessage(code))

    if (ctx.request.header('x-inertia')) {
      return ctx.inertia.render('errors/show', { status, code, message, requestId })
    }
    if (ctx.request.accepts(['json'])) {
      return ctx.response.status(status).json({ error: { code, message, requestId } })
    }
    return super.handle(error, ctx)
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add inertia/components/error_boundary.tsx inertia/app.tsx inertia/pages/errors/show.tsx app/modules/client_errors/ app/exceptions/handler.ts start/routes.ts
git commit -m "🚀 feat(errors): ErrorBoundary, /api/client-errors with PII strip, custom error pages"
```

---

## Phase 24 — Settings UI (curto)

### Task 53: Tenant settings + Users management

**Files:**

- Create: `app/modules/admin/controllers/settings_controller.ts`
- Create: `app/modules/admin/controllers/users_controller.ts`
- Modify: `app/modules/admin/routes.ts`
- Create: `inertia/pages/settings/{tenant,users}.tsx`

- [ ] **Step 1: SettingsController**

```typescript
// app/modules/admin/controllers/settings_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class SettingsController {
  async tenant(ctx: HttpContext) {
    const tenant = await db.from('tenants').where('id', ctx.tenant.id).first()
    return ctx.inertia.render('settings/tenant', { tenant })
  }
}
```

- [ ] **Step 2: UsersController**

```typescript
// app/modules/admin/controllers/users_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import auditService from '#shared/services/audit_service'
import permissionCacheService from '#shared/services/permission_cache_service'

const updateRolesValidator = vine.compile(
  vine.object({ role_ids: vine.array(vine.string().uuid()) })
)

export default class UsersController {
  async index(ctx: HttpContext) {
    const memberships = await db
      .from('tenant_memberships as tm')
      .join('users as u', 'u.id', 'tm.user_id')
      .where('tm.tenant_id', ctx.tenant.id)
      .andWhere('tm.status', 'active')
      .select('u.id', 'u.name', 'u.email', 'tm.id as membership_id')
    const roles = await db.from('roles').select()
    return ctx.inertia.render('settings/users', { memberships, roles })
  }

  async updateRoles(ctx: HttpContext) {
    const { role_ids } = await ctx.request.validateUsing(updateRolesValidator)
    const userId = ctx.params.userId
    await db
      .from('user_roles')
      .where('tenant_id', ctx.tenant.id)
      .andWhere('user_id', userId)
      .delete()
    for (const rid of role_ids) {
      await db
        .from('user_roles')
        .insert({ tenant_id: ctx.tenant.id, user_id: userId, role_id: rid })
    }
    await permissionCacheService.invalidate(ctx.tenant.id)
    await auditService.record({
      tenantId: ctx.tenant.id,
      actorUserId: ctx.auth.user!.id,
      entityType: 'user',
      entityId: userId,
      action: 'roles_updated',
      payload: { role_ids },
      requestId: ctx.requestId,
    })
    return ctx.response.redirect().back()
  }
}
```

- [ ] **Step 3: Routes em admin/routes.ts**

```typescript
const SettingsController = () => import('#modules/admin/controllers/settings_controller')
const UsersController = () => import('#modules/admin/controllers/users_controller')

router
  .get('/settings/tenant', [SettingsController, 'tenant'])
  .as('settings.tenant')
  .use(middleware.permission({ permission: 'tenants.settings' }))
router
  .get('/settings/users', [UsersController, 'index'])
  .as('settings.users.index')
  .use(middleware.permission({ permission: 'users.manage_roles' }))
router
  .post('/settings/users/:userId/roles', [UsersController, 'updateRoles'])
  .as('settings.users.update_roles')
  .use(middleware.permission({ permission: 'users.manage_roles' }))
```

- [ ] **Step 4: Pages mínimas**

```typescript
// inertia/pages/settings/tenant.tsx
import {Head} from '@inertiajs/react'

export default function TenantSettings({tenant}: { tenant: any }) {
  return (
    <>
      <Head title = "Configurações do tenant" / >
      <main><h1>{tenant.name} < /h1><p>Slug: {tenant.slug}</
  p > <p>Status
:
  {
    tenant.status
  }
  </p></m
  ain >
  </>
)
}
```

```typescript
// inertia/pages/settings/users.tsx
import {Head, router} from '@inertiajs/react'
import {useState} from 'react'

interface User {
  id: string;
  name: string;
  email: string
}

interface Role {
  id: string;
  slug: string;
  name: string
}

interface Props {
  memberships: User[];
  roles: Role[]
}

export default function UsersSettings({memberships, roles}: Props) {
  const [selected, setSelected] = useState<Record<string, string[]>>({})

  function toggleRole(userId: string, roleId: string) {
    setSelected((s) => {
      const current = s[userId] ?? []
      const next = current.includes(roleId) ? current.filter(r => r !== roleId) : [...current, roleId]
      return {...s, [userId]: next}
    })
  }

  function save(userId: string) {
    router.post(`/settings/users/${userId}/roles`, {role_ids: selected[userId] ?? []})
  }

  return (
    <>
      <Head title = "Users" / >
      <main>
        <h1>Users < /h1>
      < table >
      <thead><tr><th>Nome < /th><th>Email</
  th > <th>Roles < /th><th></
  th > </tr></
  thead >
  <tbody>
    {
      memberships.map((u) => (
        <tr key = {u.id} >
          <td>{u.name} < /td><td>{u.email}</td >
  <td>
    {
      roles.map((r) => (
        <label key = {r.id} >
        <input type = "checkbox" checked = {(selected[u.id] ?? []).includes(r.id)
    }
  onChange = {()
=>
  toggleRole(u.id, r.id)
}
  /> {r.slug}
  < /label>
))
}
  </td>
  < td > <button onClick = {()
=>
  save(u.id)
}>
  Salvar < /button></
  td >
  </tr>
))
}
  </tbody>
  < /table>
  < /main>
  < />
)
}
```

- [ ] **Step 5: Commit**

```bash
git add app/modules/admin/ inertia/pages/settings/
git commit -m "🚀 feat(settings): tenant info and users role management"
```

---

## Phase 25 — Testing infra & E2E

### Task 54: Test setup, factories, fixtures

**Files:**

- Modify: `tests/bootstrap.ts`
- Create: `tests/factories/{tenant,user,precatorio_asset}_factory.ts`
- Create: `scripts/generate_fixture_siop.ts`

- [ ] **Step 1: bootstrap test isolation**

Modificar `tests/bootstrap.ts` (preservando o que já existe):

```typescript
import { configure, processCLIArgs, run } from '@japa/runner'
import { assert } from '@japa/assert'
import { browserClient } from '@japa/browser-client'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import app from '@adonisjs/core/services/app'

processCLIArgs(process.argv.splice(2))

configure({
  files: [
    'tests/unit/**/*.spec.ts',
    'tests/integration/**/*.spec.ts',
    'tests/functional/**/*.spec.ts',
    'tests/e2e/**/*.spec.ts',
  ],
  plugins: [assert(), browserClient({ runInSuites: ['e2e'] }), pluginAdonisJS(app)],
  setup: [
    async () => {
      const db = (await import('@adonisjs/lucid/services/db')).default
      await db.connection().rawQuery('select 1') // garante conexão
    },
  ],
  teardown: [
    async () => {
      const db = (await import('@adonisjs/lucid/services/db')).default
      await db.manager.closeAll()
    },
  ],
})

run()
```

- [ ] **Step 2: Factory para Tenant**

```typescript
// tests/factories/tenant_factory.ts
import factory from '@adonisjs/lucid/factories'
import Tenant from '#models/tenant'

export const TenantFactory = factory
  .define(Tenant, ({ faker }) => ({
    id: faker.string.uuid(),
    name: faker.company.name(),
    slug:
      faker.helpers.slugify(faker.company.name()).toLowerCase() +
      '-' +
      faker.string.alphanumeric(4),
    status: 'active' as const,
    rbacVersion: 1,
  }))
  .build()
```

- [ ] **Step 3: Script generate fixture XLSX**

```typescript
// scripts/generate_fixture_siop.ts
import ExcelJS from 'exceljs'
import { resolve } from 'node:path'

async function main() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('precatorios')
  ws.addRow(['cnj', 'devedor', 'exercicio', 'valor_face', 'natureza', 'numero_precatorio'])
  for (let i = 0; i < 50; i++) {
    const seq = String(i + 1).padStart(7, '0')
    const noVerifier = seq + '20234036100'
    const verifier = (98n - (BigInt(noVerifier + '00') % 97n)).toString().padStart(2, '0')
    const cnj = `${seq}-${verifier}.2023.4.03.6100`
    ws.addRow([cnj, 'União/INSS', 2024, 100000 + i * 1000, 'alimentar', `2024-${seq}`])
  }
  await wb.xlsx.writeFile(resolve('tests/fixtures/siop/valid_2024_small.xlsx'))
  console.log('fixture gerada')
}

main().catch(console.error)
```

- [ ] **Step 4: Adicionar script + rodar**

Em `package.json` scripts:

```json
"fixtures:generate": "node --import=@poppinss/ts-exec scripts/generate_fixture_siop.ts"
```

Rodar:

```bash
mkdir -p tests/fixtures/siop
pnpm fixtures:generate
```

- [ ] **Step 5: Commit**

```bash
git add tests/bootstrap.ts tests/factories/ scripts/ package.json tests/fixtures/siop/
git commit -m "✅ test: bootstrap setup, factories, SIOP fixture generator"
```

---

### Task 55: Tenant isolation suite (must-pass)

**Files:**

- Create: `tests/integration/tenant_isolation.spec.ts`

- [ ] **Step 1: Spec**

```typescript
// tests/integration/tenant_isolation.spec.ts
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import precatorioRepository from '#modules/precatorios/repositories/precatorio_repository'

test.group('Tenant isolation', (group) => {
  let tenantA: string, tenantB: string

  group.each.setup(async () => {
    const [a] = await db
      .from('tenants')
      .insert({
        name: 'A',
        slug: `a-${Date.now()}-${Math.random()}`,
        status: 'active',
        rbac_version: 1,
      })
      .returning('id')
    const [b] = await db
      .from('tenants')
      .insert({
        name: 'B',
        slug: `b-${Date.now()}-${Math.random()}`,
        status: 'active',
        rbac_version: 1,
      })
      .returning('id')
    tenantA = a.id
    tenantB = b.id
    await db.from('precatorio_assets').insert([
      {
        tenant_id: tenantA,
        source: 'siop',
        cnj_number: 'A-CNJ',
        face_value: 100,
        lifecycle_status: 'expedited',
        nature: 'alimentar',
        pii_status: 'none',
        compliance_status: 'pending',
      },
      {
        tenant_id: tenantB,
        source: 'siop',
        cnj_number: 'B-CNJ',
        face_value: 100,
        lifecycle_status: 'expedited',
        nature: 'alimentar',
        pii_status: 'none',
        compliance_status: 'pending',
      },
    ])
  })

  test('tenant A cannot list assets of tenant B', async ({ assert }) => {
    const r = await precatorioRepository.list(tenantA, { page: 1, perPage: 10 })
    assert.equal(r.meta.total, 1)
    assert.equal(r.data[0].cnj_number, 'A-CNJ')
  })

  test('tenant B cannot list assets of tenant A', async ({ assert }) => {
    const r = await precatorioRepository.list(tenantB, { page: 1, perPage: 10 })
    assert.equal(r.meta.total, 1)
    assert.equal(r.data[0].cnj_number, 'B-CNJ')
  })

  test('unique constraints scoped per tenant', async ({ assert }) => {
    await db.from('precatorio_assets').insert({
      tenant_id: tenantA,
      source: 'siop',
      cnj_number: 'B-CNJ', // mesmo CNJ que tenant B
      face_value: 100,
      lifecycle_status: 'expedited',
      nature: 'alimentar',
      pii_status: 'none',
      compliance_status: 'pending',
    })
    const a = await db.from('precatorio_assets').where('tenant_id', tenantA).count('* as c')
    assert.equal(Number(a[0].c), 2)
  })
})
```

- [ ] **Step 2: Rodar e commit**

```bash
pnpm test --files="tests/integration/tenant_isolation.spec.ts"
git add tests/integration/tenant_isolation.spec.ts
git commit -m "✅ test(security): tenant isolation suite (must-pass on CI)"
```

---

### Task 56: E2E golden path (Playwright via Japa browser-client)

**Files:**

- Create: `tests/e2e/golden_path.spec.ts`

- [ ] **Step 1: Spec**

```typescript
// tests/e2e/golden_path.spec.ts
import { test } from '@japa/runner'

test.group('E2E — golden path', (group) => {
  group.tap((t) => t.tags(['@e2e']))

  test('login → dashboard → list precatorios', async ({ visit, assert }) => {
    const page = await visit('/auth/login')
    await page.fill('input[type="email"]', 'admin@benicio.local')
    await page.fill('input[type="password"]', 'admin1234')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard|\/tenants\/select/)
    if (page.url().includes('/tenants/select')) {
      await page.click('button') // primeiro tenant
      await page.waitForURL('/dashboard')
    }
    await assert.equal(new URL(page.url()).pathname, '/dashboard')
    await page.goto('/precatorios')
    assert.match(page.url(), /\/precatorios/)
  })
})
```

- [ ] **Step 2: Run + commit**

> Pré-requisito: usuário `admin@benicio.local` existe (criado pelo seeder Task 35) e tenant Benício seedado.

```bash
node ace migration:fresh --seed
pnpm test --tags="@e2e"
git add tests/e2e/golden_path.spec.ts
git commit -m "✅ test(e2e): golden path login → dashboard → precatorios"
```

---

## Phase 26 — Documentação

### Task 57: README + AGENTS.md + docs/\*

**Files:**

- Modify: `README.md`
- Create: `AGENTS.md`
- Create: `docs/{schema-overview,pii-bunker-policy,rbac-roles,testing-guide,import-runbook}.md`

- [ ] **Step 1: README com setup local**

Substituir `README.md`:

````markdown
# juridicai

Sistema de Originação e Qualificação de Precatórios (Spec 1 — Radar Federal Base).

## Setup local

```bash
docker compose up -d
pnpm install
cp .env.example .env
# preencher PII_HASH_PEPPER e PII_ENCRYPTION_KEY com `openssl rand -hex 32`
node ace migration:run
node ace db:seed --files="./database/seeders/index_seeder.ts"
pnpm dev          # HTTP em http://localhost:3333
pnpm start:worker # worker BullMQ separado
```
````

Login dev: `admin@benicio.local` / `admin1234`.

## Comandos úteis

```bash
pnpm test                    # todos os testes
pnpm test:unit
pnpm test:integration
pnpm test:functional
pnpm test --tags="@e2e"      # E2E
pnpm typecheck
pnpm lint
node ace make:migration <name>
node ace migration:fresh --seed
```

## Documentação

- [`docs/schema-overview.md`](docs/schema-overview.md) — entidades e relações
- [`docs/pii-bunker-policy.md`](docs/pii-bunker-policy.md) — base legal, fluxo PII, retenção
- [`docs/rbac-roles.md`](docs/rbac-roles.md) — roles e permissions
- [`docs/testing-guide.md`](docs/testing-guide.md) — como rodar suítes
- [`docs/import-runbook.md`](docs/import-runbook.md) — operação de import + reprocess

## Spec & Plan

- Spec: [
  `docs/superpowers/specs/2026-04-28-radar-federal-base-design.md`](docs/superpowers/specs/2026-04-28-radar-federal-base-design.md)
- Plan: [
  `docs/superpowers/plans/2026-04-28-radar-federal-base-plan.md`](docs/superpowers/plans/2026-04-28-radar-federal-base-plan.md)

````

- [ ] **Step 2: AGENTS.md (regras críticas)**

```markdown
# juridicai — Agent Instructions

Sistema multi-tenant Adonis 7 + Inertia + React + PostgreSQL + Redis.

## Critical Rules (MUST follow)

1. **Multi-tenant isolation**: TODA query de domínio precisa filtrar por `tenant_id`. Use `BaseRepository.query(tenantId)` ou `ctx.tenant.id`. NUNCA bypass.
2. **Enum sync**: PG enum value = TS model union type = Vine validator enum — idênticos. Mudança em qualquer um exige migration + atualização.
3. **Raw SQL escopo**: só pra GENERATED columns, triggers, views, native enums, partial indexes, extensions. Lucid schema builder pra resto.
4. **Service singleton**: `export default new Service()` — nunca exportar a classe.
5. **DateTime**: Luxon `DateTime` em models, ISO em transport.
6. **Tenant context**: usar `ctx.tenant.id` após `middleware.tenant()`, não raw header.
7. **Validators**: VineJS compiled validators em rotas. Nunca `request.only()` cru em API.
8. **PII**: jamais em `audit_logs.payload`, `radar_job_runs.metadata`, ou logs (validators/redaction obrigatórios).
9. **withTenantRls**: por chunk curto, nunca em volta de job inteiro.
10. **PII reveal**: SEMPRE via função `pii.reveal_beneficiary` (SECURITY DEFINER) — nunca app-side.

## Do NOT
- Criar arquivos manualmente — usar `pnpm ace make:*`
- Query sem `tenant_id` (vazamento cross-tenant)
- Usar `any` sem comentário
- Modificar `audit_logs` ou `pii.access_logs` (PG RULES bloqueiam UPDATE/DELETE)
- Skip emoji no commit
- Hard-code cores/spacing — usar Tailwind config (Phase 27 polish)

## Commit messages
gitmoji prefix, concise, "why" not "what":
- 🚀 feat, 🐛 fix, 💄 style, 🔧 chore, 🌱 seed, 🗃️ refactor(db), ♻️ refactor, ✅ test, 📝 docs, 🔒 security
````

- [ ] **Step 3: Doc files mínimos**

Criar 5 arquivos com 1-2 parágrafos cada apontando pro spec doc principal:

```bash
cat > docs/schema-overview.md <<EOF
# Schema overview

Ver [spec doc · seção 7](superpowers/specs/2026-04-28-radar-federal-base-design.md).

Entidades centrais:
- \`tenants\` + \`tenant_memberships\` — multi-tenancy
- \`source_records\` — procedência genérica
- \`siop_imports\` + \`siop_staging_rows\` — pipeline ingestão
- \`precatorio_assets\` + \`asset_events\` + \`asset_scores\` — domínio
- \`pii.beneficiaries\` + \`pii.asset_beneficiaries\` + \`pii.access_logs\` — bunker isolado
- \`audit_logs\` + \`security_audit_logs\` + \`radar_job_runs\` — observabilidade

RLS habilitado em \`pii.*\`, \`audit_logs\`, \`security_audit_logs\`. Append-only via PG RULES.
EOF

cat > docs/pii-bunker-policy.md <<EOF
# PII Bunker Policy

## Base legal
Fonte pública + legítimo interesse documentado, com LIA, minimização, opt-out e auditoria.
Consentimento explícito não é exigido no v0 (transformaria produto em inbound puro).

## Arquitetura
- Schema \`pii.*\` isolado, RLS por tenant
- HMAC-SHA256(PII_HASH_PEPPER) → \`beneficiary_hash\` (identificação pseudônima)
- pgp_sym_encrypt(PII_ENCRYPTION_KEY) → name_encrypted, document_encrypted
- Reveal SOMENTE via função \`pii.reveal_beneficiary\` (SECURITY DEFINER)
- Cada acesso loga em \`pii.access_logs\` (append-only)

## Operação
- attempt_reveal antes de qualquer validação
- reveal_denied registra motivo
- reveal_success registra purpose + justification + ip + ua
- Rate limit 10/h por user

## Rotação
Pepper/key separados. Rotacionar exige re-hash/re-encrypt em batch (operação dedicada, fora do v0).
EOF

cat > docs/rbac-roles.md <<EOF
# RBAC Roles e Permissions

Roles dinâmicas via tabelas \`roles\`, \`permissions\`, \`role_permissions\`, \`user_roles\`.

## Roles padrão (seed)

| Role | Descrição |
|------|-----------|
| \`radar_reader\` | leitura de precatórios e imports |
| \`legal_reviewer\` | radar_reader + criar/reprocessar imports + auditar/scorrear assets |
| \`sales_authorized\` | leitura + revelar PII mascarado (futuro) |
| \`privacy_admin\` | gerencia PII (reveal_full, export, opt_out), users, settings, exports |
| \`tenant_admin\` | tudo do tenant exceto PII operations sensíveis |

## Cache
\`radar:perm:{tenantId}:{userId}:{rbac_version}\` — invalidado por bump de \`tenants.rbac_version\`.

## Como adicionar permissão
1. Adicionar slug em \`database/seeders/permissions_seeder.ts\`
2. Adicionar em roles relevantes em \`roles_seeder.ts\`
3. Rodar \`node ace db:seed --files="./database/seeders/index_seeder.ts"\`
EOF

cat > docs/testing-guide.md <<EOF
# Testing Guide

## Suites
- \`pnpm test:unit\` — pure logic (parsers, helpers, validators)
- \`pnpm test:integration\` — DB + Redis real (services, repositories, jobs)
- \`pnpm test:functional\` — HTTP + Inertia
- \`pnpm test --tags="@e2e"\` — Playwright via Japa browser-client

## Setup
\`\`\`bash
docker compose up -d
node ace migration:fresh --seed
pnpm test
\`\`\`

## Coverage targets
- unit ≥ 85%, integration ≥ 70%, functional ≥ 60%, overall ≥ 70%
- Tenant isolation: 100% must-pass

## Fixtures
\`tests/fixtures/siop/\` — gerar com \`pnpm fixtures:generate\`.
EOF

cat > docs/import-runbook.md <<EOF
# Import Runbook

## Operação normal
1. Usuário (legal_reviewer+) faz upload em \`/imports/new\`
2. Validações: file size, mime, exercise_year
3. Drive salva em \`storage/siop/<tenant>/<year>/<checksum>.xlsx\`
4. \`source_records\` + \`siop_imports\` criados
5. BullMQ \`siop:import\` enfileirado com jobId determinístico
6. Worker processa em chunks (advisory lock por importId)
7. Status: pending → running → completed | partial | failed

## Re-upload do mesmo arquivo
- import completed: 409 Conflict ("já importado em <data>")
- import pending/running: 200/202 redirect, sem novo job
- import failed/partial: permite reprocess

## Reprocess manual
\`POST /imports/:id/reprocess\` (legal_reviewer+) — cria novo \`radar_job_runs\` com \`run_number+1\`, \`parent_run_id\`.

## Erro: arquivo corrompido
- siop_imports.status = failed
- /imports/{id}/errors lista \`siop_staging_rows\` com validation_status=invalid
- /imports/{id}/download-source baixa original pra investigar

## Housekeeping
- \`maintenance:purge_staging\` weekly: deleta staging > 90 dias
- staging rows com \`processed_at\` ficam pra audit; pruned em background
EOF
```

- [ ] **Step 4: Commit final**

```bash
git add README.md AGENTS.md docs/
git commit -m "📝 docs: README, AGENTS.md, and 5 domain docs"
```

---

## Phase 27 — Polish (post-v0 nice-to-have)

> **Nota:** itens nessa phase não são must-have para SPEC-001. Implementar apenas se houver tempo após critérios de
> aceite cumpridos.

### Task 58: Layout Metronic adaptado

Importar componentes do template `~/Documents/metronic-v9.4.10/metronic-tailwind-react-starter-kit/typescript/vite/`
selecionando apenas: `Sidebar`, `Topbar`, `Card`, `KPI`, `Badge`, `Button`, `DataTable`, `ApexChartCard`, `Toaster`.
Adaptar pra usar Inertia routing em vez de react-router. Aplicar nas pages de imports, precatorios, debtors, dashboard.

### Task 59: ApexCharts no Dashboard

Substituir os `<ul>` simples por `<ApexChart>` (bar para yearly, horizontal bar para top debtors).

### Task 60: TanStack Table

Refatorar `precatorios/index.tsx` pra usar TanStack Table com filtros server-side, sort por coluna clicável, paginação.

### Task 61: Tailwind v4 + radix-ui setup

`pnpm add -D @tailwindcss/vite tailwind-merge clsx class-variance-authority`. Configurar `vite.config.ts` com plugin
Tailwind v4. Importar primitives radix conforme necessidade.

---

## Self-review

Plan completo escrito. Vou re-verificar contra o spec.

**1. Spec coverage:**

| Spec section              | Plan task                                 |
| ------------------------- | ----------------------------------------- |
| §3 Decisões arquiteturais | Tasks 1-9 (setup, helpers, models)        |
| §5 Estrutura de diretório | Task 1 (paths) + estrutura inline         |
| §6 Modelo de dados        | Tasks 10-32 (todas migrations)            |
| §6 Crypto setup           | Task 32                                   |
| §7 Pipeline SIOP          | Tasks 36-39                               |
| §8 Auth/RBAC/Tenant       | Tasks 14-17, 33-35                        |
| §8 PII bunker operacional | Tasks 23-25, 32, 47                       |
| §9 UI/Dashboard           | Tasks 41, 44, 45, 46                      |
| §10 Jobs/Scheduler        | Tasks 28-30, 51                           |
| §11 Erros/observabilidade | Tasks 4, 17, 27, 48, 52                   |
| §12 Testing               | Tasks 54-56                               |
| §14 Critérios de aceite   | Cobertura distribuída ao longo das phases |

**2. Placeholder scan:**

Não detectei "TBD", "TODO", "fill in details". Itens marcados como Phase 27 (polish) são explicitamente fora do escopo
SPEC-001 mas listados pra continuidade.

**3. Type consistency:**

- `withTenantRls` (Task 7) recebe `(tenantId, callback)` — usado em Tasks 25, 38, 47
- `BaseRepository<M>` (Task 9) — herdado por repositories nas Tasks 42, 45
- `TenantContext.run/get/tryGet` (Task 6) — usado em Tasks 17, 38, 39
- `permissionCacheService.userHas/loadPermissions/invalidate` (Task 16) — usado em Tasks 17, 47, 53
- `auditService.record/recordSecurity` (Task 27) — usado em Tasks 33, 34, 40, 49, 50, 53
- `jobRunService.start/complete/skip/fail` (Task 29) — usado em Tasks 39, 50, 51
- `queueService.getQueue/registerWorker/shutdown` (Task 29) — usado em Tasks 30, 39, 49, 50, 51
- `mapCodeToMessage` / `errorMessages` (Task 8) — usado em Task 52 (handler)
- `sanitizeError` (Task 8) — usado em Tasks 29, 52
- Enums de status (Task 10) — referenciados em todas migrations subsequentes

Todos batem.

**4. Itens reforçados pra fase de execução:**

- Worker heartbeat update precisa ser implementado dentro do worker (loop a cada 10s atualizando `worker_heartbeats`).
  Acrescentar como sub-task quando rodar Task 30 ou 51 — anotado em comentário do `bin/worker.ts`.
- Inertia shared props (`auth.user`, `tenant.current`, `permissions[]`, `requestId`) precisam ser configuradas em
  `app/middleware/inertia_middleware.ts` (já existe do starter — modificar). Anotado em Task 17 implicitamente; pode
  virar Task adicional 17.5.
- Coluna `tenant_id` em alguns lookups da função `pii.reveal_beneficiary` referencia
  `current_setting('app.current_tenant_id')` que é setado pelo `withTenantRls`. Coerente.

**Spec items que deveria virar task explícita ainda:**

Adiciono uma task curta:

### Task 17.5: Inertia shared middleware (props globais)

**Files:**

- Modify: `app/middleware/inertia_middleware.ts`

- [ ] **Step 1: Editar o middleware existente**

```typescript
// app/middleware/inertia_middleware.ts (modificado)
import { Inertia } from '@adonisjs/inertia'
import permissionCacheService from '#shared/services/permission_cache_service'

export default Inertia.handle({
  share: {
    auth: async (ctx) => {
      const user = ctx.auth?.user
      return user ? { id: user.id, name: user.name, email: user.email } : null
    },
    tenant: async (ctx) => (ctx.tenant ? { id: ctx.tenant.id } : null),
    permissions: async (ctx) => {
      if (!ctx.auth?.user || !ctx.tenant) return []
      return permissionCacheService.loadPermissions(ctx.auth.user.id, ctx.tenant.id)
    },
    flashes: (ctx) => ctx.session.flashMessages.all(),
    requestId: (ctx) => ctx.requestId,
    csrfToken: (ctx) => ctx.request.csrfToken,
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add app/middleware/inertia_middleware.ts
git commit -m "🚀 feat(inertia): share auth/tenant/permissions/requestId/csrf as global props"
```

---

## Resumo final

**Tasks:** 58 (numeradas 1-57 + 17.5)
**Phases:** 27
**Critical commits:** 50+ commits granulares
**Test coverage:** unit + integration + functional + E2E + tenant isolation must-pass

Pode executar incrementalmente. Cada task é commit-friendly e self-contained (TDD onde aplicável, write+verify+commit
nos demais).
