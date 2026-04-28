---
title: Radar Federal Base — Spec 1 (juridicai)
status: approved
date: 2026-04-28
spec_id: SPEC-001
sequence: 1 of N
authors:
  - Marlon (product/arch)
  - Claude (collaborator)
supersedes: none
related_specs:
  - SPEC-002 (DataJud Enrichment, future)
  - SPEC-003 (DJEN Publications, future)
---

# Spec 1 — Radar Federal Base

## Sumário executivo

Monolito **AdonisJS v7 + Inertia 4 + React 19 (Metronic v9.4.10) + Lucid 22 + PostgreSQL + BullMQ + Redis** que ingere
todo o histórico de precatórios federais do **SIOP** (~2010-2025) num modelo **multi-tenant** com **PII bunker**
isolada (schema `pii.*` + RLS) e expõe um **dashboard read-only** pra inspeção. Estabelece a fundação arquitetural pras
Specs 2 (DataJud) e 3 (DJEN).

**One-liner para o produto:** "Não vendemos lista de pessoas. Qualificamos ativos judiciais com dados públicos, scoring
jurídico-financeiro e governança comercial."

## Posicionamento e escopo

### Escopo do produto (visão completa)

```
juridicai = sistema multi-tenant de originação e qualificação de precatórios

  módulos macro (cada um vira N specs):
    1. Radar          — descoberta multi-fonte de ativos
    2. Intelligence   — scoring, classificação, IA de publicações
    3. Sales          — CRM jurídico-comercial
    4. Compliance     — LGPD, base legal, opt-out, auditoria
    5. Pricing        — IPCA+2%, EC 136/2025, TIR, deságio
```

### Escopo deste spec (Spec 1)

Spec 1 = **Radar Federal Base — somente SIOP**. É o primeiro tijolo do módulo Radar. Não inclui DataJud, DJEN, scoring,
CRM, pricing ou tribunais estaduais.

#### Inclui

- Importador idempotente XLSX/CSV do SIOP com staging + normalização + dedup
- Modelagem multi-tenant (`tenant_id` em todas tabelas de negócio + RLS Postgres em `pii.*` e `audit_logs`)
- Bunker PII em schema `pii.*` (mesmo que SIOP federal não traga PII direta — fontes futuras virão)
- Auth (Adonis Auth session-based) + RBAC dinâmico via tabelas (`roles`, `permissions`, `role_permissions`,
  `user_roles`)
- Dashboard read-only Inertia (login, tenant select, dashboard, imports, precatórios, devedores, admin/health, settings)
- Jobs via BullMQ + Redis com worker process separado
- Audit log universal (append-only via PG RULES)
- `radar_job_runs` como histórico persistente de execução
- Materialized views pra agregados do dashboard
- Suite de testes Japa (unit/integration/functional/E2E)
- Spec é **dev-local first** — sem deploy de produção

#### Fora deste spec

| Item                                   | Vai para                                                |
| -------------------------------------- | ------------------------------------------------------- |
| DataJud enrichment                     | Spec 2                                                  |
| DJEN publications + NLP                | Spec 3                                                  |
| Scoring rule-based completo            | Spec 2 (depois do DataJud enriquecer)                   |
| Fila de revisão humana                 | Spec 2                                                  |
| CRM/Sales pipeline                     | Spec do módulo Sales                                    |
| Pricing engine (IPCA+2%, TIR, deságio) | Spec dedicado                                           |
| Crawlers TJ/TRF/municipais             | Spec por tribunal                                       |
| Deploy/produção                        | Spec 2                                                  |
| Real-time (Adonis Transmit/SSE)        | Spec 2                                                  |
| TanStack Query                         | Spec 2                                                  |
| APM externo (Sentry, Datadog)          | Spec 2+                                                 |
| Prometheus/Grafana                     | Infra dedicada                                          |
| OpenTelemetry                          | Infra dedicada                                          |
| Bull Board UI                          | Não implementar — `/admin/jobs` próprio é tenant-scoped |

### Critério de aceite (visão geral)

Banco populado com `precatorio_assets` de todo histórico SIOP federal disponível, dashboard mostra lista
paginada/filtrável, página de imports lista cada exercício com status/erros, healthcheck verde, RLS testado com pelo
menos 2 tenants em fixture, suite de testes com cobertura mínima dos paths críticos do importador. **Checklist completo
na seção 14.**

## Decisões arquiteturais consolidadas

### Stack técnico

| Camada              | Escolha                          | Justificativa                                                                                                  |
| ------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Linguagem backend   | TypeScript (Node 24)             | Stack do eduguard, ecossistema rico pra ETL/Adonis                                                             |
| Framework           | AdonisJS v7                      | Convergência total com eduguard; Inertia + Lucid + Auth + Bouncer integrados                                   |
| Frontend bundler    | Vite (via @adonisjs/vite)        | First-class no Adonis 7                                                                                        |
| Frontend framework  | React 19 + Inertia 4             | Template Metronic v9.4.10 React Vite TS já licenciado                                                          |
| UI Kit              | Metronic v9.4.10 (camadas)       | Layout/cards base · Radix primitives · TanStack Table engine · ApexCharts · Sonner toast · cmdk · lucide-react |
| Forms               | RHF + Zod (frontend)             | Padrão Metronic                                                                                                |
| Validators backend  | VineJS                           | Padrão eduguard; PG enum = TS type = Vine enum (idênticos)                                                     |
| ORM                 | Lucid 22                         | Padrão Adonis                                                                                                  |
| Banco               | PostgreSQL 15+                   | Multi-tenant via tenant_id + RLS seletivo                                                                      |
| Cache & Queue       | Redis 7                          | Padrão eduguard (BullMQ)                                                                                       |
| Queue runner        | BullMQ ^5                        | Padrão eduguard; mesma instância Redis com namespaces separados                                                |
| Storage de arquivos | @adonisjs/drive (S3 ou FS local) | XLSX brutos do SIOP                                                                                            |
| Scheduler           | adonisjs-scheduler               | Comandos ace que enfileiram BullMQ                                                                             |
| Logger              | pino via @adonisjs/logger        | Estruturado, com redaction                                                                                     |
| Testes              | Japa (Adonis) + Playwright (E2E) | Padrão Adonis 7                                                                                                |
| Dependências        | pnpm (workspace)                 | Padrão eduguard                                                                                                |

### Decisões transversais

1. **Multi-tenant shared schema com `tenant_id`** em todas as tabelas de negócio. RLS Postgres em schemas sensíveis (
   `pii.*`, `audit_logs`, `security_audit_logs`).
2. **`tenant_memberships` many-to-many.** No v0, sessão = um tenant ativo, mas modelagem é N-to-N pra suportar
   consultoria/multi-org no futuro.
3. **Caches públicos podem ser globais (sem `tenant_id`)** — tipo `public_datajud_cache` no Spec 2. Já modelar essa
   distinção mentalmente.
4. **PII Bunker Architecture** — schema `pii.*` isolado, criptografia at-rest (pgcrypto + bytea), funções
   `SECURITY DEFINER` controladas, audit log de cada acesso.
5. **`HMAC-SHA256(pepper, normalized_key)` no `beneficiary_hash`** — não SHA puro (CPF tem espaço pequeno).
6. **Audit append-only** via PG RULES (`audit_logs`, `pii.access_logs` bloqueiam UPDATE/DELETE). Retenção via job
   `apply_retention_policy` (renomeado de `purge_audit_logs`).
7. **Backfill todo histórico SIOP disponível (~2010-2025).** Implica `lifecycle_status` distinguindo
   expedido/pago/cancelado, importer batch idempotente, índices cuidados.
8. **`source_records` table genérica** — toda staging/asset/process/publication aponta pra um registro de origem
   imutável.
9. **`asset_scores` separado** com versionamento (`score_version`); `precatorio_assets` guarda só `current_score` +
   `current_score_id`.
10. **`radar_job_runs` como histórico persistente do produto** — BullMQ é volátil/operacional; `audit_logs` é
    compliance.

### Decisões frontend específicas

1. **Inertia faz routing server-driven** — sem react-router. Páginas vivem em `inertia/pages/{feature}/{file}.tsx`.
2. **Templates Metronic adaptados, não copiados.** Removidos: react-router, auth mock, fetching mock. Mantidos: layouts,
   componentes base, theme, charts.
3. **TanStack Query NÃO no v0.** Estado server-of-truth via Inertia + `router.reload({ only: [...] })` para refresh
   parcial.
4. **PII reveal usa axios JSON puro** — sai do ciclo Inertia. Resposta efêmera no body, **nunca** em page props.
5. **Permissões na UI são cosméticas** — backend revalida com Bouncer em todo controller.

## Decomposição do produto em sub-projetos (sequência)

```
Spec 1 (este)         Radar Federal Base (SIOP)              ~5-7 semanas
Spec 2                DataJud Enrichment                     ~6-8 semanas
Spec 3                DJEN Publications + NLP                ~10-12 semanas
Spec 4                Intelligence Scoring v1                ~4-6 semanas
Spec 5                Sales/CRM Pipeline                     ~10-14 semanas
Spec 6                Pricing Engine (EC 136/2025)           ~6-8 semanas
Spec 7                Crawlers TJ (estaduais)                N/cliente
Spec 8                Compliance UI + LGPD ops               ~4-6 semanas
Spec 9                Deploy/produção/observabilidade        ~3-4 semanas
```

## Estrutura de diretório

Inspirada no projeto eduguard:

```
juridicai/
├── ace.js
├── adonisrc.ts
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json
├── tsconfig.frontend.json
├── eslint.config.js
├── docker-compose.yml          # postgres + redis + app + worker
├── .env.example
├── README.md
├── AGENTS.md                   # padrão eduguard
├── CLAUDE.md                   # padrão eduguard
│
├── app/
│   ├── exceptions/
│   │   ├── handler.ts
│   │   └── domain_exceptions.ts
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── controllers/
│   │   │   ├── models/
│   │   │   ├── repositories/
│   │   │   ├── services/
│   │   │   ├── validators/
│   │   │   ├── policies/
│   │   │   └── routes.ts
│   │   ├── tenant/
│   │   ├── permission/
│   │   ├── siop/
│   │   │   ├── controllers/
│   │   │   ├── jobs/                 # siop_import_handler, etc
│   │   │   ├── services/             # siop_import_service, siop_normalize_service
│   │   │   ├── parsers/              # cnj_parser, value_parser, debtor_normalizer
│   │   │   ├── validators/
│   │   │   └── routes.ts
│   │   ├── precatorios/
│   │   ├── debtors/
│   │   ├── pii/                      # bunker PII
│   │   │   ├── controllers/
│   │   │   ├── services/             # reveal_service
│   │   │   ├── policies/
│   │   │   └── routes.ts
│   │   ├── exports/
│   │   ├── maintenance/
│   │   │   ├── jobs/
│   │   │   └── commands/             # purge_staging, apply_retention_policy, etc
│   │   ├── dashboard/
│   │   ├── admin/                    # /admin/health, /admin/jobs
│   │   └── healthcheck/
│   │
│   └── shared/
│       ├── helpers/
│       │   ├── tenant_context.ts     # AsyncLocalStorage
│       │   ├── with_tenant_rls.ts
│       │   ├── sanitize_error.ts
│       │   ├── timed.ts
│       │   ├── error_messages.ts     # mapCodeToMessage
│       │   └── safe_json_view.ts     # server-side PII redact
│       ├── middleware/
│       │   ├── auth_middleware.ts
│       │   ├── request_id_middleware.ts
│       │   ├── tenant_middleware.ts
│       │   ├── permission_middleware.ts
│       │   └── inertia_share_middleware.ts
│       ├── models/
│       │   ├── tenant_base_model.ts  # com soft delete
│       │   └── tenant_model.ts       # sem soft delete
│       ├── repositories/
│       │   └── base_repository.ts    # tenant scope automático
│       ├── services/
│       │   ├── audit_service.ts
│       │   ├── job_run_service.ts
│       │   ├── permission_cache_service.ts
│       │   ├── queue_service.ts      # BullMQ wrapper
│       │   └── feature_flag_service.ts
│       └── types/
│           └── inertia.ts
│
├── config/
│   ├── auth.ts
│   ├── bodyparser.ts
│   ├── bouncer.ts
│   ├── cors.ts
│   ├── database.ts
│   ├── drive.ts
│   ├── inertia.ts
│   ├── logger.ts
│   ├── redis.ts
│   ├── session.ts
│   └── vite.ts
│
├── database/
│   ├── migrations/
│   │   ├── 0000_create_extensions_table.ts
│   │   ├── 0001_create_enums_table.ts
│   │   ├── 0010_create_tenants_table.ts
│   │   ├── 0011_create_users_table.ts
│   │   ├── 0012_create_auth_tokens_table.ts
│   │   ├── 0013_create_tenant_memberships_table.ts
│   │   ├── 0020_create_permissions_table.ts
│   │   ├── 0021_create_roles_table.ts
│   │   ├── 0022_create_role_permissions_table.ts
│   │   ├── 0023_create_user_roles_table.ts
│   │   ├── 0030_create_source_records_table.ts
│   │   ├── 0031_create_siop_imports_table.ts
│   │   ├── 0032_create_siop_staging_rows_table.ts
│   │   ├── 0040_create_debtors_table.ts
│   │   ├── 0041_create_precatorio_assets_table.ts
│   │   ├── 0042_create_asset_events_table.ts
│   │   ├── 0043_create_asset_scores_table.ts
│   │   ├── 0050_create_judicial_processes_table.ts
│   │   ├── 0051_create_publications_table.ts
│   │   ├── 0052_create_publication_events_table.ts
│   │   ├── 0060_create_pii_schema.ts
│   │   ├── 0061_create_pii_beneficiaries_table.ts
│   │   ├── 0062_create_pii_asset_beneficiaries_table.ts
│   │   ├── 0063_create_pii_access_logs_table.ts
│   │   ├── 0064_create_pii_reveal_function.ts
│   │   ├── 0070_create_audit_logs_table.ts
│   │   ├── 0071_create_security_audit_logs_table.ts
│   │   ├── 0072_create_radar_job_runs_table.ts
│   │   ├── 0073_create_worker_heartbeats_table.ts
│   │   ├── 0080_create_export_jobs_table.ts
│   │   ├── 0081_create_client_errors_table.ts
│   │   ├── 0082_create_retention_config_table.ts
│   │   ├── 0083_create_retention_manifest_table.ts
│   │   └── 9999_create_views_and_triggers_table.ts
│   ├── seeders/
│   │   ├── index_seeder.ts
│   │   ├── permissions_seeder.ts
│   │   ├── roles_seeder.ts
│   │   └── tenant_benicio_seeder.ts
│   └── factories/
│       ├── tenant_factory.ts
│       ├── user_factory.ts
│       ├── precatorio_asset_factory.ts
│       └── ...
│
├── inertia/
│   ├── app.tsx
│   ├── components/                # adaptados do Metronic
│   │   ├── layout/
│   │   ├── ui/                    # primitives radix
│   │   ├── data-table/            # TanStack Table
│   │   ├── charts/
│   │   ├── states/                # Empty/Loading/Error/Denied
│   │   ├── pii/
│   │   │   ├── reveal_dialog.tsx
│   │   │   └── safe_json_view.tsx
│   │   └── tenant_switcher.tsx
│   ├── config/
│   ├── css/
│   ├── hooks/
│   │   ├── use_permissions.ts
│   │   ├── use_import_polling.ts
│   │   └── use_request_id.ts
│   ├── lib/
│   ├── pages/
│   │   ├── auth/
│   │   ├── tenants/
│   │   ├── dashboard/
│   │   ├── imports/
│   │   ├── precatorios/
│   │   ├── debtors/
│   │   ├── admin/
│   │   ├── settings/
│   │   └── errors/
│   ├── types/
│   └── layouts/
│
├── start/
│   ├── env.ts
│   ├── kernel.ts                  # middleware pipeline
│   ├── routes.ts                  # importa routes de cada módulo
│   ├── jobs.ts                    # bootWorkers
│   ├── queue.ts                   # boot BullMQ
│   └── scheduler.ts
│
├── bin/
│   ├── server.ts
│   └── worker.ts
│
├── public/
├── resources/
├── storage/
│   ├── logs/
│   └── siop/                      # XLSX brutos (Drive FS local em dev)
│
├── tests/
│   ├── bootstrap.ts
│   ├── factories/
│   ├── fixtures/
│   │   └── siop/
│   │       ├── valid_2024_small.xlsx
│   │       ├── valid_2024_medium.xlsx
│   │       ├── corrupted.xlsx
│   │       ├── partial_invalid.xlsx
│   │       └── duplicate_rows.xlsx
│   ├── unit/
│   ├── integration/
│   ├── functional/
│   ├── e2e/
│   └── performance/
│
└── docs/
    ├── superpowers/specs/
    │   └── 2026-04-28-radar-federal-base-design.md  # este doc
    ├── schema-overview.md
    ├── pii-bunker-policy.md
    ├── rbac-roles.md
    ├── testing-guide.md
    └── import-runbook.md
```

### Path imports (package.json `imports`)

```json
{
  "imports": {
    "#modules/*": "./app/modules/*.js",
    "#shared/*": "./app/shared/*.js",
    "#exceptions/*": "./app/exceptions/*.js",
    "#config/*": "./config/*.js",
    "#database/*": "./database/*.js",
    "#start/*": "./start/*.js"
  }
}
```

## Modelo de dados

### Convenção de enums

Todo campo grafado como `text not null` com lista de valores em comentário (`-- a|b|c`) é enum **nativo PostgreSQL**
criado em `0001_create_enums_table.ts` via raw SQL (única migration onde raw é justificado). Schema final usa
`<enum_type_name>` mas para legibilidade do design o spec lista valores inline.

**Regra:** PG enum value = TS model union type = Vine enum validator — idênticos. Mudança em qualquer um requer
migration + atualização nos outros dois (validador de drift na CI).

Exemplos de enums:

```sql
create type lifecycle_status as enum (
  'unknown','discovered','expedited','pending','in_payment','paid','cancelled','suspended'
  );
create type pii_status as enum (
  'none','pseudonymous','bunker_available','materialized','blocked'
  );
create type compliance_status as enum (
  'pending','approved_for_analysis','approved_for_sales','blocked','opt_out'
  );
create type debtor_type as enum (
  'union','state','municipality','autarchy','foundation'
  );
create type import_status as enum (
  'pending','running','completed','partial','failed'
  );
create type job_run_status as enum (
  'pending','running','completed','failed','skipped','cancelled'
  );
create type job_run_origin as enum (
  'scheduler','http','manual_retry','system'
  );
create type pii_action as enum (
  'attempt_reveal','reveal_denied','reveal_success','export','contact','update','delete'
  );
-- + outros conforme necessário
```

### Schema `public.*` — negócio

```sql
-- ── Tenancy & Auth ──────────────────────────────
tenants
( id uuid pk default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  document text, -- CNPJ
  status text not null default 'active', -- active|suspended|inactive
  plan text,
  rbac_version int not null default 1, -- bump invalida cache de permissões
  timestamps)

users
( id uuid pk default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  status text not null default 'active', -- active|disabled
  timestamps)

tenant_memberships
( id uuid pk default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  user_id uuid not null references users(id),
  status text not null default 'active', -- active|inactive
  timestamps,
  unique (tenant_id, user_id))

auth_tokens
  (...)
  -- Adonis padrão (remember-me)

-- ── RBAC dinâmico (pattern eduguard) ────────────
  permissions
  (id, name, slug unique, description, timestamps)
  roles
  (id, name, slug unique, description, timestamps)
  role_permissions
  (role_id, permission_id, primary key (role_id, permission_id))
  user_roles
( id uuid pk,
  tenant_id uuid not null,
  user_id uuid not null,
  role_id uuid not null,
  timestamps,
  unique (tenant_id, user_id, role_id))

-- ── Source records (procedência genérica) ────────
source_records
( id uuid pk,
  tenant_id uuid not null,
  source text not null, -- siop|datajud|djen|tribunal|api_private|manual
  source_url text,
  source_file_path text, -- Drive path
  source_checksum text, -- sha256 pra arquivos
  original_filename text, -- nome original do arquivo (UI/suporte)
  mime_type text, -- ex: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  file_size_bytes bigint,
  collected_at timestamptz not null,
  raw_data jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, source, source_checksum) where source_checksum is not null)

-- ── SIOP Ingestion ──────────────────────────────
siop_imports
( id uuid pk,
  tenant_id uuid not null,
  exercise_year int not null,
  source_record_id uuid not null references source_records(id),
  source text not null default 'siop',
  status text not null default 'pending', -- pending|running|completed|partial|failed
  started_at timestamptz,
  finished_at timestamptz,
  total_rows int not null default 0,
  inserted int not null default 0,
  updated int not null default 0,
  skipped int not null default 0,
  errors int not null default 0,
  raw_metadata jsonb,
  uploaded_by_user_id uuid,
  timestamps,
  deleted_at timestamptz,
  unique (tenant_id, source, exercise_year, source_record_id))

siop_staging_rows
( id uuid pk,
  import_id uuid not null references siop_imports(id) on delete cascade,
  raw_data jsonb not null,
  normalized_cnj text,
  normalized_debtor_key text,
  normalized_value numeric (18,2),
  normalized_year int,
  validation_status text not null default 'pending', -- pending|valid|invalid|warning
  errors jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now())

-- ── Domínio: Devedores ──────────────────────────
debtors
( id uuid pk,
  tenant_id uuid not null,
  name text not null,
  normalized_name text not null,
  normalized_key text not null, -- ex: "municipio_sao_paulo"
  debtor_type text not null, -- union|state|municipality|autarchy|foundation
  cnpj text,
  state_code char (2),
  payment_regime text, -- none|special|federal_unique|...
  rcl_estimate numeric (18,2),
  debt_stock_estimate numeric (18,2),
  payment_reliability_score smallint,
  timestamps,
  deleted_at timestamptz,
  unique (tenant_id, debtor_type, cnpj) where cnpj is not null,
  unique (tenant_id, debtor_type, state_code, normalized_key) where cnpj is null)

-- ── Domínio: Precatório (entidade central) ──────
precatorio_assets
( id uuid pk,
  tenant_id uuid not null,
  source_record_id uuid references source_records(id),
  source text not null, -- siop|datajud|djen|manual
  external_id text, -- id no SIOP
  cnj_number text,
  origin_process_number text,
  debtor_id uuid references debtors(id),
  asset_number text, -- número do precatório quando expedido
  exercise_year int,
  budget_year int,
  nature text not null default 'unknown', -- alimentar|comum|tributario|unknown
  face_value numeric (18,2),
  estimated_updated_value numeric (18,2),
  base_date date,
  queue_position int,
  lifecycle_status text not null default 'unknown',
  -- unknown|discovered|expedited|pending|in_payment|paid|cancelled|suspended
  pii_status text not null default 'none',
  -- none|pseudonymous|bunker_available|materialized|blocked
  compliance_status text not null default 'pending',
  -- pending|approved_for_analysis|approved_for_sales|blocked|opt_out
  current_score smallint,
  current_score_id uuid, -- FK pra asset_scores adicionada via ALTER (ciclo)
  raw_data jsonb,
  row_fingerprint text, -- hash de fallback
  timestamps,
  deleted_at timestamptz,
  unique (tenant_id, source, external_id) where external_id is not null,
  unique (tenant_id, cnj_number) where cnj_number is not null)

asset_events
( id uuid pk,
  tenant_id uuid not null,
  asset_id uuid not null references precatorio_assets(id) on delete cascade,
  event_type text not null, -- siop_imported|siop_updated|score_recomputed|...
  event_date timestamptz not null default now(),
  source text,
  payload jsonb,
  idempotency_key text not null, -- import_id + staging_row_id + raw_row_hash
  created_at timestamptz not null default now(),
  unique (tenant_id, asset_id, event_type, idempotency_key))

-- ── Score versionado ────────────────────────────
asset_scores
( id uuid pk,
  tenant_id uuid not null,
  asset_id uuid not null references precatorio_assets(id),
  score_version text not null,
  data_quality_score smallint,
  maturity_score smallint,
  liquidity_score smallint,
  legal_signal_score smallint,
  economic_score smallint,
  risk_score smallint,
  final_score smallint,
  explanation jsonb,
  computed_at timestamptz not null default now(),
  index (tenant_id, asset_id, computed_at desc))

-- FK circular adicionada via ALTER após ambas as tabelas existirem
-- (migration dedicada 9999_create_views_and_triggers_table.ts ou similar):
--   ALTER TABLE precatorio_assets
--     ADD CONSTRAINT fk_precatorio_assets_current_score
--     FOREIGN KEY (current_score_id) REFERENCES asset_scores(id)
--     ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

-- ── Schemas preparados (v0 cria, Spec 2/3 popula) ─
judicial_processes
( id uuid pk,
  tenant_id uuid not null,
  cnj_number text,
  court text,
  justice_branch text,
  class_code text,
  class_name text,
  subject text,
  filing_date date,
  secrecy_level text,
  source_record_id uuid references source_records(id),
  last_movement_at timestamptz,
  raw_data jsonb,
  timestamps,
  deleted_at timestamptz,
  unique (tenant_id, cnj_number) where cnj_number is not null)

publications
( id uuid pk,
  tenant_id uuid not null,
  process_id uuid references judicial_processes(id),
  source_record_id uuid references source_records(id),
  source text not null,
  publication_date timestamptz not null,
  text_hash text,
  text_content text,
  extracted_event_type text,
  summary text,
  raw_data jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, source, text_hash, publication_date) where text_hash is not null)

publication_events
( id uuid pk,
  tenant_id uuid not null,
  publication_id uuid not null references publications(id),
  event_type text not null,
  payload jsonb,
  created_at timestamptz not null default now())

-- ── Audit (append-only via PG RULES) ────────────
audit_logs
( id uuid pk,
  tenant_id uuid, -- nullable! eventos pré-tenant resolution
  actor_user_id uuid,
  entity_type text not null,
  entity_id text,
  action text not null,
  payload jsonb, -- VALIDADOR runtime rejeita PII
  ip_address inet,
  user_agent text,
  request_id uuid,
  created_at timestamptz not null default now())

security_audit_logs
( id uuid pk,
  ip_address inet,
  user_agent text,
  request_id uuid,
  action text not null, -- login.failed|csrf.mismatch|tenant.unauthorized|...
  code text,
  email_hash text, -- nunca email plain
  payload jsonb,
  created_at timestamptz not null default now())

-- ── Job tracking (produto, não BullMQ) ──────────
radar_job_runs
( id uuid pk,
  tenant_id uuid, -- nullable pra jobs system
  job_name text not null,
  queue_name text not null,
  bullmq_job_id text,
  bullmq_attempt int not null default 1,
  run_number int not null default 1,
  parent_run_id uuid references radar_job_runs(id),
  origin text not null default 'http', -- scheduler|http|manual_retry|system
  target_type text,
  target_id uuid,
  status text not null, -- pending|running|completed|failed|skipped|cancelled
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms int generated always as (
  extract (epoch from (finished_at - started_at)) * 1000
  ) stored,
  error_code text,
  error_message text,
  error_stack text, -- prod sanitiza
  metadata jsonb, -- VALIDADOR rejeita PII
  request_id uuid,
  created_at timestamptz not null default now())

worker_heartbeats
( worker_id text primary key,
  hostname text not null,
  pid int not null,
  queues text [] not null,
  started_at timestamptz not null,
  last_seen_at timestamptz not null)

-- ── Exports ─────────────────────────────────────
export_jobs
( id uuid pk,
  tenant_id uuid not null,
  requested_by_user_id uuid not null,
  type text not null, -- precatorios_csv
  filters jsonb,
  status text not null default 'pending', -- pending|running|completed|failed|expired
  output_path text, -- Drive path
  signed_url_expires_at timestamptz,
  row_count int,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  request_id uuid,
  created_at timestamptz not null default now())

-- ── Client errors / retention ───────────────────
client_errors
( id uuid pk,
  tenant_id uuid, -- nullable
  user_id uuid,
  url text,
  message text,
  stack text,
  component_stack text,
  request_id uuid,
  user_agent text,
  ip_address inet,
  created_at timestamptz not null default now())

retention_config
( log_type text primary key, -- audit_logs|pii.access_logs|client_errors|...
  retention_days int not null,
  min_days_for_pii_access_logs int, -- só pra log_type relevante
  enabled boolean not null default true,
  updated_at timestamptz not null default now())

retention_manifest
( id uuid pk,
  log_type text not null,
  range_from timestamptz not null,
  range_to timestamptz not null,
  estimated_rows int not null,
  status text not null default 'pending', -- pending|confirmed|applied|aborted
  created_by text not null default 'system',
  created_at timestamptz not null default now(),
  applied_at timestamptz)
```

### Schema `pii.*` — bunker isolado (RLS hard)

```sql
create schema pii;

pii.beneficiaries(
  id uuid pk,
  tenant_id uuid not null,
  beneficiary_hash text not null,        -- HMAC-SHA256(pepper, normalized_key)
  name_encrypted bytea,                  -- pgcrypto pgp_sym_encrypt
  document_encrypted bytea,
  document_type text,                    -- cpf|cnpj|passport|other
  document_last4 char(4),                -- pra UI mostrar mascarado
  person_type text,                      -- natural_person|legal_person|unknown
  source text not null,                  -- siop|tribunal|djen|api_private|manual
  source_url text,
  source_collected_at timestamptz not null,
  source_checksum text,
  lawful_basis text not null,            -- legitimate_interest|consent|contract|legal_obligation
  purpose text not null,
  lia_id uuid,
  opt_out boolean not null default false,
  retention_until timestamptz,
  timestamps,
  unique(tenant_id, beneficiary_hash)
)

pii.asset_beneficiaries(
  id uuid pk,
  tenant_id uuid not null,
  asset_id uuid not null,                -- FK lógica pra public.precatorio_assets
  beneficiary_id uuid not null references pii.beneficiaries(id),
  role text,                             -- principal|attorney|heir|assignee|unknown
  amount numeric(18,2),
  amount_ratio numeric(10,6),
  created_at timestamptz not null default now(),
  unique(tenant_id, asset_id, beneficiary_id, role)
)

pii.access_logs(
  id uuid pk,
  tenant_id uuid not null,
  actor_user_id uuid not null,
  beneficiary_id uuid,
  asset_id uuid,
  action text not null,                  -- attempt_reveal|reveal_denied|reveal_success|export|contact|update|delete
  purpose text not null,
  lawful_basis text,
  justification text,
  ip_address inet,
  user_agent text,
  request_id uuid,
  created_at timestamptz not null default now()
)

-- Função controlada SECURITY DEFINER
create or replace function pii.reveal_beneficiary(
  p_beneficiary_id uuid,
  p_purpose text,
  p_justification text,
  p_actor_user_id uuid,
  p_asset_id uuid default null,
  p_ip_address inet default null,
  p_user_agent text default null,
  p_request_id uuid default null
)
  returns table
          (
            name          text,
            document      text,
            document_type text
          )
  language plpgsql
  security definer
  set search_path = pii, public, pg_temp
as
$$
declare
  v_tenant_id   uuid;
  v_beneficiary pii.beneficiaries;
  v_has_perm    boolean;
begin
  v_tenant_id := current_setting('app.current_tenant_id', true)::uuid;
  if v_tenant_id is null then
    raise exception 'E_TENANT_NOT_RESOLVED';
  end if;

  -- registra tentativa ANTES de qualquer validação (rastreabilidade total)
  insert into pii.access_logs(tenant_id, actor_user_id, beneficiary_id, asset_id,
                              action, purpose, justification, ip_address, user_agent, request_id)
  values (v_tenant_id, p_actor_user_id, p_beneficiary_id, p_asset_id,
          'attempt_reveal', p_purpose, p_justification, p_ip_address, p_user_agent, p_request_id);

  -- valida actor + membership ativa
  if not exists (select 1
                 from public.tenant_memberships
                 where user_id = p_actor_user_id
                   and tenant_id = v_tenant_id
                   and status = 'active') then
    insert into pii.access_logs(tenant_id, actor_user_id, beneficiary_id, asset_id,
                                action, purpose, justification, ip_address, user_agent, request_id)
    values (v_tenant_id, p_actor_user_id, p_beneficiary_id, p_asset_id,
            'reveal_denied', p_purpose, p_justification, p_ip_address, p_user_agent, p_request_id);
    raise exception 'E_TENANT_MEMBERSHIP_INACTIVE';
  end if;

  -- valida permission pii.reveal_full ou pii.reveal_masked
  select exists (select 1
                 from public.user_roles ur
                        join public.role_permissions rp on rp.role_id = ur.role_id
                        join public.permissions p on p.id = rp.permission_id
                 where ur.user_id = p_actor_user_id
                   and ur.tenant_id = v_tenant_id
                   and p.slug in ('pii.reveal_full', 'pii.reveal_masked'))
  into v_has_perm;

  if not v_has_perm then
    insert into pii.access_logs(tenant_id, actor_user_id, beneficiary_id, asset_id,
                                action, purpose, justification, ip_address, user_agent, request_id)
    values (v_tenant_id, p_actor_user_id, p_beneficiary_id, p_asset_id,
            'reveal_denied', p_purpose, p_justification, p_ip_address, p_user_agent, p_request_id);
    raise exception 'E_PII_REVEAL_FORBIDDEN';
  end if;

  -- carrega beneficiary
  select *
  into v_beneficiary
  from pii.beneficiaries
  where id = p_beneficiary_id
    and tenant_id = v_tenant_id;

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

  -- valida asset_id pertence ao tenant (se informado)
  if p_asset_id is not null then
    if not exists (select 1
                   from public.precatorio_assets
                   where id = p_asset_id
                     and tenant_id = v_tenant_id) then
      raise exception 'E_ROW_NOT_FOUND asset';
    end if;
  end if;

  -- registra acesso ANTES de retornar
  insert into pii.access_logs(tenant_id, actor_user_id, beneficiary_id, asset_id,
                              action, purpose, justification, lawful_basis, ip_address, user_agent, request_id)
  values (v_tenant_id, p_actor_user_id, p_beneficiary_id, p_asset_id,
          'reveal_success', p_purpose, p_justification, v_beneficiary.lawful_basis,
          p_ip_address, p_user_agent, p_request_id);

  return query select pgp_sym_decrypt(v_beneficiary.name_encrypted, current_setting('app.pii_encryption_key'))::text,
                      pgp_sym_decrypt(v_beneficiary.document_encrypted,
                                      current_setting('app.pii_encryption_key'))::text,
                      v_beneficiary.document_type;
end;
$$;
```

### Crypto setup — pepper de hash + chave de criptografia (separados)

**Princípio:** dois segredos distintos, dois propósitos. Vazamento de um não compromete o outro.

```
PII_HASH_PEPPER       — HMAC-SHA256 → beneficiary_hash (identificação pseudônima)
PII_ENCRYPTION_KEY    — pgp_sym_encrypt/decrypt → name_encrypted, document_encrypted
```

Ambos são strings hex de 32+ bytes random, armazenados no `.env` e nunca commitados.

Toda conexão Postgres precisa ter `app.pii_encryption_key` setada antes de chamar `pii.reveal_beneficiary` ou de inserir
em `pii.beneficiaries.name_encrypted` / `document_encrypted`. O `app.hash_pepper` **não** precisa ir pro Postgres — o
HMAC é calculado app-side em `node:crypto`.

```
Opção 1 (recomendada) — afterCreate hook do pool de conexão Lucid:
  config/database.ts:
    pool: {
      afterCreate: (conn, done) => {
        conn.query(`select set_config('app.pii_encryption_key', $1, false)`,
                   [env.get('PII_ENCRYPTION_KEY')], done)
      }
    }
  set_config com false = scope de sessão → vale por toda a vida da conexão.

Opção 2 — ALTER ROLE:
  ALTER ROLE juridicai_app SET app.pii_encryption_key = '...';
  Pior pra rotação (chave fica em pg_settings/pg_db_role_setting). Apenas dev local.

Recomendado v0: Opção 1 com PII_ENCRYPTION_KEY em .env.
```

**Função `pii.reveal_beneficiary` usa:**

```sql
pgp_sym_decrypt
  (name_encrypted, current_setting('app.pii_encryption_key'))
  pgp_sym_decrypt
  (document_encrypted, current_setting('app.pii_encryption_key'))
```

**App-side (Node) usa:**

```ts
// app/modules/pii/services/hash_service.ts
import { createHmac } from 'node:crypto'

const pepper = env.get('PII_HASH_PEPPER')

function beneficiaryHash(name: string, document?: string): string {
  const normalizedKey = `${stripAccents(name).toLowerCase()}|${onlyDigits(document ?? '')}`
  return createHmac('sha256', pepper).update(normalizedKey).digest('hex')
}
```

**Rotação:** rotacionar `PII_ENCRYPTION_KEY` exige re-encrypt em batch de `pii.beneficiaries`. Rotacionar
`PII_HASH_PEPPER` invalida todos os `beneficiary_hash` (re-hash em batch). Ambos viram operações dedicadas, fora do v0;
documentar em `docs/pii-bunker-policy.md`.

**`beneficiary_hash`:**

- `HMAC-SHA256(PII_HASH_PEPPER, normalized_key)`
- `normalized_key = lowercase(strip_accents(name)) || '|' || only_digits(document)`
- calculado app-side antes de inserir (não na função reveal)
- permite query por hash sem decryption

### RLS habilitado (β — só sensíveis)

```sql
alter table pii.beneficiaries
  enable row level security;
alter table pii.asset_beneficiaries
  enable row level security;
alter table pii.access_logs
  enable row level security;
alter table public.audit_logs
  enable row level security;

create policy tenant_isolation on pii.beneficiaries
  using (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
create policy tenant_isolation on pii.asset_beneficiaries
  using (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
create policy tenant_isolation on pii.access_logs
  using (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
create policy tenant_isolation on public.audit_logs
  using (tenant_id is null OR tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```

### Append-only (PG RULES)

```sql
create rule no_update_audit_logs as on update to public.audit_logs do instead nothing;
create rule no_delete_audit_logs as on delete to public.audit_logs do instead nothing;
create rule no_update_pii_access_logs as on update to pii.access_logs do instead nothing;
create rule no_delete_pii_access_logs as on delete to pii.access_logs do instead nothing;
create rule no_update_security_audit_logs as on update to public.security_audit_logs do instead nothing;
create rule no_delete_security_audit_logs as on delete to public.security_audit_logs do instead nothing;
```

### Materialized views

```sql
create materialized view v_dashboard_metrics as
select tenant_id,
       count(*)                                                        as total_assets,
       count(distinct debtor_id)                                       as debtors_count,
       sum(face_value)                                                 as total_face_value,
       count(*) filter (where lifecycle_status = 'expedited')          as expedited_count,
       count(*) filter (where lifecycle_status = 'paid')               as paid_count,
       count(*) filter (where created_at > now() - interval '30 days') as new_30d
from public.precatorio_assets
where deleted_at is null
group by tenant_id;
create unique index on v_dashboard_metrics (tenant_id);

create materialized view v_debtor_aggregates as
select pa.tenant_id,
       pa.debtor_id,
       d.name                          as debtor_name,
       count(*)                        as asset_count,
       sum(pa.face_value)              as total_face_value,
       sum(pa.estimated_updated_value) as total_estimated_value
from public.precatorio_assets pa
       join public.debtors d on d.id = pa.debtor_id
where pa.deleted_at is null
group by pa.tenant_id, pa.debtor_id, d.name;
create unique index on v_debtor_aggregates (tenant_id, debtor_id);

create materialized view v_asset_yearly_stats as
select tenant_id, exercise_year, count(*) as count, sum(face_value) as total
from public.precatorio_assets
where deleted_at is null
group by tenant_id, exercise_year;
create unique index on v_asset_yearly_stats (tenant_id, exercise_year);
```

### Índices críticos

```sql
-- Hot paths do dashboard
create index on precatorio_assets (tenant_id, lifecycle_status, created_at desc);
create index on precatorio_assets (tenant_id, debtor_id, lifecycle_status);
create index on precatorio_assets (tenant_id, exercise_year, lifecycle_status);
create index on precatorio_assets (tenant_id, face_value desc) where lifecycle_status = 'expedited';

-- Imports
create index on siop_imports (tenant_id, exercise_year, status);
create index on siop_staging_rows (import_id, validation_status);

-- Audit/jobs
create index on audit_logs (tenant_id, entity_type, entity_id, created_at desc);
create index on audit_logs (tenant_id, actor_user_id, created_at desc);
create index on radar_job_runs (tenant_id, status, created_at desc);
create index on radar_job_runs (tenant_id, target_type, target_id);
create index on radar_job_runs (parent_run_id);

-- PII
create index on pii.asset_beneficiaries (tenant_id, asset_id);
create index on pii.access_logs (tenant_id, actor_user_id, created_at desc);

-- Source records
create index on source_records (tenant_id, source, collected_at desc);
```

## Pipeline SIOP — data flow

### Sequência ponta-a-ponta

```
[1] User (legal_reviewer ou privacy_admin) faz upload XLSX/CSV em /imports/new
    ── Adonis Controller valida (VineJS): file size, mime, exercise_year, source
    ── Drive (S3 ou FS local) salva em storage/siop/<tenant_id>/<year>/<checksum>.xlsx
    ── INSERT em source_records (source=siop, file_path, checksum, collected_at)
    ── INSERT em siop_imports (status='pending', source_record_id, exercise_year)
    ── enqueue BullMQ:
        queue.add('siop:import', { importId, tenantId, requestId },
                  { jobId: `siop:import:${tenantId}:${importId}`, attempts: 3 })
    ── Inertia redirect → /imports/{id} (status='pending')

[2] BullMQ Worker pega job (concurrency=1 pra siop:import)
    ── INSERT radar_job_runs (status='running', bullmq_job_id, attempt, run_number=1)
    ── UPDATE siop_imports SET status='running', started_at=now()
    ── TenantContext.run(tenantId, async () => { ... })
    ── advisory lock: select pg_try_advisory_xact_lock(hashtext(import_id))
       └─ se NÃO locked: jobRunService.skip(runId, 'already_running')
    ── ELSE: prossegue

[3] Parser streaming (exceljs) — batches 1000 rows
    ── Pra cada chunk:
       └─ withTenantRls(tenantId, async (trx) => {
            await trx.from('siop_staging_rows').insert(batchOf1000)
          })
    ── siop_imports.total_rows incrementado

[4] Normalizador pós-parse (segundo pass, batches 5000)
    ── Pra cada row pendente:
       a) valida CNJ (formato, dígito verificador)
       b) normaliza devedor (UPPERCASE, remove acentos, slug → normalized_key)
       c) parseia valor (locale BR: vírgula decimal)
       d) valida exercise_year
       e) marca validation_status: valid|invalid|warning
       f) errors[] em jsonb se inválido

[5] Consolidação domínio (transação por chunk de 1k-5k)
    ── withTenantRls por chunk:
       a) Upsert debtor:
          ── primary: SELECT por (tenant_id, debtor_type, cnpj)
          ── fallback: SELECT por (tenant_id, debtor_type, state, normalized_key) where cnpj is null
          ── INSERT debtors com normalized_name + normalized_key
       b) Upsert precatorio_assets (match cascade):
          ── 1ª: (tenant_id, source, external_id) where external_id is not null
          ── 2ª: (tenant_id, source, cnj_number) where cnj_number is not null
          ── 3ª: (tenant_id, source, row_fingerprint)
          ── INSERT: lifecycle_status='discovered', pii_status='none', compliance_status='pending'
          ── UPDATE: merge raw_data; preserva campos manuais
       c) INSERT asset_events com idempotency_key:
          ── idempotency_key = import_id + staging_row_id + raw_row_hash
          ── ON CONFLICT DO NOTHING
          ── event_type: 'siop_imported' (se INSERT) ou 'siop_updated' (se UPDATE com diff)
       d) UPDATE siop_staging_rows SET processed_at = now()

[6] Reconciliation
    ── siop_imports.inserted/updated/skipped/errors atualizados
    ── status: 'completed' (errors=0) | 'partial' (errors>0) | 'failed' (exception)
    ── finished_at = now()
    ── jobRunService.complete(runId)
    ── audit_logs INSERT { action: 'siop_import_completed', payload: stats }

[7] Notificação
    ── Inertia push via shared props: toast Sonner "Import {year} concluído: {n} novos, {m} atualizados"

[8] Housekeeping (job agendado, separado, weekly)
    ── DELETE siop_staging_rows WHERE processed_at < now() - INTERVAL '90 days'
    ── Não toca audit_logs ou pii.access_logs (append-only forever)
```

### State machine — `siop_imports.status`

```
pending  → running  → completed
                   → partial    (terminal — completed mas com errors > 0)
                   → failed     (terminal — exception não-tratada)

reprocess (de partial/failed):
  partial → running  → completed | partial | failed
  failed  → running  → completed | partial | failed
```

### Idempotência e divergência

```
A — Re-import com correção do SIOP (mesmo arquivo, dados atualizados):
  asset.raw_data atualizado · asset_events { event_type:'siop_updated', diff }
  campos manuais (compliance_status, pii_status) preservados

B — Row inválida no arquivo:
  validation_status='invalid' · errors jsonb
  não vira asset · aparece em /imports/{id}/errors

C — Mesmo arquivo re-uploaded:
  unique(tenant_id, source, exercise_year, source_record_id) → 409 Conflict
  EXCEÇÕES:
    - import pending/running existente: 200/202 redirect, sem novo job
    - import failed/partial: permite reprocessar mesmo siop_imports, novo radar_job_runs

D — Duas linhas SIOP mesmo CNJ (bug fonte):
  1ª: INSERT · 2ª: warning em staging_row · não falha import
```

## Auth, RBAC, Tenant context, PII bunker — operacional

### Pipeline middleware HTTP

```
http request
  → cors
  → request_id (sanitiza incoming x-request-id, gera UUID se inválido)
  → session
  → bodyparser
  → silent_auth (popula ctx.auth.user se logado, sem forçar)
  → auth (força login pra rotas autenticadas)
  → tenant (resolve active_tenant_id; popula ctx.tenant; TenantContext.run)
  → permission (pré-check de permissions, opcional por rota)
  → inertia_share (shared props: user, tenant, flashes, permissions, requestId)
  → controller
```

### TenantMiddleware

```typescript
// app/shared/middleware/tenant_middleware.ts
import { HttpContext } from '@adonisjs/core/http'
import TenantContext from '#shared/helpers/tenant_context'
import membershipService from '#modules/tenant/services/membership_service'

export default class TenantMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.user!
    const activeTenantId = ctx.session.get('active_tenant_id')

    if (!activeTenantId) {
      return ctx.response.redirect('/tenants/select')
    }

    const membership = await membershipService.findActive(user.id, activeTenantId)
    if (!membership) {
      ctx.session.forget('active_tenant_id')
      return ctx.response.unauthorized({ error: 'E_TENANT_MEMBERSHIP_INACTIVE' })
    }

    ctx.tenant = { id: activeTenantId, membership }

    return TenantContext.run(activeTenantId, async () => next())
  }
}

declare module '@adonisjs/core/http' {
  interface HttpContext {
    tenant: { id: string; membership: any }
    requestId: string
  }
}
```

### `withTenantRls` (operações que tocam pii ou audit)

```typescript
// app/shared/helpers/with_tenant_rls.ts
import db from '@adonisjs/lucid/services/db'

export async function withTenantRls<T>(
  tenantId: string,
  cb: (trx: TransactionClientContract) => Promise<T>
): Promise<T> {
  return db.transaction(async (trx) => {
    await trx.rawQuery(`select set_config('app.current_tenant_id', ?, true)`, [tenantId])
    return cb(trx)
  })
}
```

**REGRA:** uma transação por chunk curto, NÃO em volta de job inteiro. Importer usa loop:

```typescript
for (const chunk of chunks) {
  await withTenantRls(tenantId, async (trx) => {
    // upsert 1k-5k rows
  })
}
```

### RBAC — roles e permissions seed

```
permissions (seed):
  precatorios.read           imports.read           imports.create
  imports.reprocess          imports.download_source
  assets.audit               assets.score           assets.export
  pii.reveal_masked          pii.reveal_full        pii.export
  pii.opt_out_manage
  users.invite               users.manage_roles
  tenants.settings           tenants.manage
  admin.jobs.read            admin.jobs.retry
  exports.create             exports.download

roles (seed):
  radar_reader      → precatorios.read, imports.read
  legal_reviewer    → radar_reader + imports.create, imports.reprocess,
                                     imports.download_source, assets.audit, assets.score
  sales_authorized  → precatorios.read + opportunities.* (futuro) + pii.reveal_masked
  privacy_admin     → pii.reveal_full, pii.export, pii.opt_out_manage,
                      users.invite, tenants.settings, exports.create, exports.download
  tenant_admin      → tudo do tenant exceto pii.reveal_full e pii.export
```

### Cache de permissões versionado

```
key: radar:perm:{tenantId}:{userId}:{rbacVersion}
value: JSON array de permission slugs
TTL: 60s (defesa de fundo)

invalidação: tenants.rbac_version++ em qualquer mudança de role/permission/membership
```

### Fluxo PII reveal (one-shot, JSON efêmero)

```
[1] User clica "ver beneficiário" no /precatorios/{id}
    └─ frontend abre modal RevealDialog pedindo: purpose + justification

[2] POST /pii/beneficiaries/{id}/reveal { purpose, justification, asset_id }
    Headers: X-CSRF-Token, X-Request-Id

    Controller:
    ── Bouncer.authorize('PiiPolicy', 'reveal')   // pii.reveal_masked ou pii.reveal_full
    ── valida purpose, justification.length >= 20
    ── rate limit: Redis sliding window 10/h por user → 429 + audit
    ── withTenantRls(ctx.tenant.id, async (trx) => {
         const result = await trx.rawQuery(`
           select * from pii.reveal_beneficiary($1,$2,$3,$4,$5,$6,$7,$8)
         `, [beneficiaryId, purpose, justification, ctx.auth.user.id,
             assetId, ctx.request.ip(), ctx.request.header('user-agent'), ctx.requestId])
         return result.rows[0]
       })
    ── response.json({ name, document, document_type })   // NÃO Inertia

    A função SECURITY DEFINER faz TUDO server-side:
    ── valida tenant atual via current_setting
    ── valida actor membership ativa
    ── valida permission slug
    ── valida beneficiary tenant match
    ── valida asset tenant match (se informado)
    ── valida opt_out=false
    ── INSERT em pii.access_logs (action='reveal_success' ou 'reveal_denied')
    ── decripta name/document via pgp_sym_decrypt(app.pii_encryption_key)
    ── retorna decryptado

[3] Frontend RevealDialog:
    ── exibe dado em modal one-shot
    ── auto-clear: setTimeout(() => setData(null), 90 * 1000)
    ── ESC, click outside, botão "Ocultar agora" limpam
    ── visibilitychange listener: aba hidden → limpa data
    ── NÃO armazena em store global, session, localStorage
```

## UI / Dashboard

### Mapa de telas v0

```
público:
GET  /healthz                      ok|degraded|down JSON simples

auth:
GET  /auth/login                   tela login
POST /auth/login                   attempt + session.regenerate
POST /auth/logout                  session.clear

tenant:
GET  /tenants/select               lista memberships ativas
POST /tenants/select               valida + seta active_tenant_id

app:
GET  /dashboard                    overview (KPIs + charts)
GET  /imports                      list paginated
GET  /imports/new                  form upload (legal_reviewer+)
POST /imports                      handle upload, enqueue
GET  /imports/{id}                 detail (status, stats, polling)
POST /imports/{id}/reprocess       (legal_reviewer+, status=failed|partial)
GET  /imports/{id}/errors          staging rows inválidas
GET  /imports/{id}/download-source (legal_reviewer+, audit log)

GET  /precatorios                  list paginated/filtered (TanStack Table)
GET  /precatorios/{id}             detail (tabs: visão geral, eventos, devedor, beneficiários, audit)

GET  /debtors                      list por devedor
GET  /debtors/{id}                 detail

POST /pii/beneficiaries/{id}/reveal  JSON efêmero (sales_authorized | privacy_admin)

POST /exports/precatorios          cria export_jobs (privacy_admin/tenant_admin)
GET  /exports/{id}                 status + signed URL

GET  /admin/health                 detalhe sanitizado (privacy_admin/tenant_admin)
GET  /admin/health/live            liveness
GET  /admin/health/ready           readiness
GET  /admin/jobs                   radar_job_runs paginado (privacy_admin/tenant_admin)
POST /admin/jobs/{runId}/retry     manual retry

GET  /settings/tenant              configurações (tenant_admin)
GET  /settings/users               users + memberships + roles (privacy_admin/tenant_admin)
POST /settings/users/invite
POST /settings/users/{id}/roles    incrementa rbac_version

POST /api/client-errors            recebe erros do frontend

errors:
  401 → "Entrar novamente" → /auth/login
  403 → "Voltar" → router.history.back()
  404 → "Ir ao dashboard" → /dashboard
  419 → redirect back + flash "Sessão expirou"
  500 → "Tentar novamente" → window.location.reload()
```

### Layout master (Metronic adaptado)

```
<DefaultLayout>
  <Sidebar>
    [Logo juridicai]
    Nav (filtrado por permission do user):
      📊 Dashboard          radar_reader+
      📥 Imports            radar_reader+
      📋 Precatórios        radar_reader+
      🏛️ Devedores          radar_reader+
      ⚙️ Configurações      tenant_admin/privacy_admin
    [TenantSwitcher]        se memberships > 1
    [UserMenu — logout]
  </Sidebar>
  <Topbar>
    [Breadcrumb] [⌘K cmdk (futuro)] [Avatar]
  </Topbar>
  <main>{children}</main>
  <Toaster />  // sonner
</DefaultLayout>
```

### Papéis dos componentes

| Camada       | Pacote                        | Função                                   |
| ------------ | ----------------------------- | ---------------------------------------- |
| Layout/cards | Metronic                      | Sidebar, Topbar, KPI cards, theme        |
| Primitives   | radix-ui                      | Dialog, Dropdown, Tooltip, Popover, Tabs |
| Tabela       | @tanstack/react-table         | Pagination, sort, filter, virtualization |
| Charts       | apexcharts + react-apexcharts | bar, line, donut, sparkline              |
| Toasts       | sonner                        | Notificações                             |
| Forms        | react-hook-form + zod         | Validação client-side                    |
| Ícones       | lucide-react                  | Único set de ícones                      |

### Estado / data fetching

```
- Inertia padrão: controller → props → page renderiza
- Refresh parcial: router.reload({ only: ['kpis'] })
- Polling import progress: useImportPolling(id, status)
- Mutations: router.post / router.delete (Inertia)
- EXCEÇÃO: PII reveal usa axios JSON puro (fora ciclo Inertia)
- TanStack Query NÃO no v0
```

### Estados padronizados

Cada página de listagem precisa de:

- `<EmptyState />` — nenhum dado
- `<LoadingState />` — primeira carga
- `<ErrorState />` — erro inesperado, mostra requestId
- `<DeniedState />` — sem permissão (403)

### `useImportPolling` (hook)

```typescript
function useImportPolling(importId: string, currentStatus: string) {
  const finalStates = ['completed', 'partial', 'failed']
  const [backoff, setBackoff] = useState(3000)

  useEffect(() => {
    if (finalStates.includes(currentStatus)) return
    if (document.hidden) return

    const tick = async () => {
      try {
        await router.reload({ only: ['import', 'stats'] })
        setBackoff(3000) // reset
      } catch {
        setBackoff((prev) => Math.min(prev * 2, 60000)) // exponential
      }
    }

    const interval = setInterval(tick, backoff)
    const onVisibilityChange = () => {
      if (!document.hidden) tick()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [importId, currentStatus, backoff])
}
```

### `<SafeJsonView />`

Renderiza `raw_data jsonb` mascarado server-side:

```
radar_reader:        nem renderiza (ausente nas props)
legal_reviewer:      mascarado (***)
privacy_admin:       full (com pii.reveal_full)

Mascaramento server-side antes de virar prop, usando lista:
['cpf','cnpj','document','name','email','phone','beneficiary',
 'beneficiario','rg','passport','telefone']
```

## Jobs, Scheduler, Queues

### Inventário de jobs

| Queue       | Job                                  | Concurrency | Attempts | Trigger             |
| ----------- | ------------------------------------ | ----------- | -------- | ------------------- |
| siop        | `siop:import`                        | 1           | 3        | HTTP upload         |
| siop        | `siop:reprocess`                     | 1           | 3        | HTTP retry endpoint |
| siop        | `siop:reconcile`                     | 1           | 3        | scheduler weekly    |
| maintenance | `maintenance:purge_staging`          | 1           | 2        | scheduler weekly    |
| maintenance | `maintenance:apply_retention_policy` | 1           | 1        | scheduler monthly   |
| maintenance | `maintenance:refresh_aggregates`     | 1           | 3        | scheduler 15min     |
| maintenance | `maintenance:vacuum_hint`            | 1           | 1        | scheduler daily     |
| exports     | `exports:precatorios_csv`            | 2           | 3        | HTTP export request |

### Scheduler (`adonisjs-scheduler`)

```typescript
// start/scheduler.ts
scheduler.command('queue:enqueue siop:reconcile').weeklyOn(0, '03:00')
scheduler.command('queue:enqueue maintenance:purge_staging').weeklyOn(0, '03:30')
scheduler.command('queue:enqueue maintenance:apply_retention_policy').monthlyOn(1, '04:00')
scheduler.command('queue:enqueue maintenance:refresh_aggregates').everyFifteenMinutes()
scheduler.command('queue:enqueue maintenance:vacuum_hint').dailyAt('02:00')
```

**Princípio:** scheduler/comando ace **APENAS enfileira**, não executa direto. Exceção: flag `--run-inline` pra ops
manual.

### BullMQ jobId determinístico

```typescript
queue.add('siop:import', payload, {
  jobId: `siop:import:${tenantId}:${importId}`,
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
})

// reprocess com run_number embutido
queue.add('siop:reprocess', payload, {
  jobId: `siop:reprocess:${tenantId}:${importId}:${fromStep}:${runNumber}`,
})

// refresh_aggregates por slot de 15min
const windowId = Math.floor(Date.now() / (15 * 60 * 1000))
queue.add(
  'maintenance:refresh_aggregates',
  {},
  {
    jobId: `refresh_aggregates:${windowId}`,
  }
)
```

**Anti-sobreposição:** antes de `queue.add`, `queue.getJob(jobId)` checa se já tem active/delayed; se sim, skip.

### Worker boot

```typescript
// start/jobs.ts
import queueService from '#shared/services/queue_service'
// imports de handlers...

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

export function bootWorkers() {
  queueService.registerWorker(queues.siopImport.name, siopImportHandler)
  queueService.registerWorker(queues.siopReprocess.name, siopReprocessHandler)
  queueService.registerWorker(queues.siopReconcile.name, siopReconcileHandler)
  queueService.registerWorker(queues.purgeStaging.name, purgeStagingHandler)
  queueService.registerWorker(queues.retentionPolicy.name, applyRetentionPolicyHandler)
  queueService.registerWorker(queues.refreshAggregates.name, refreshAggregatesHandler)
  queueService.registerWorker(queues.vacuumHint.name, vacuumHintHandler)
  queueService.registerWorker(queues.exportPrecatorios.name, exportPrecatoriosHandler)
}
```

### Handler anatomy padronizada

```typescript
// app/modules/siop/jobs/siop_import_handler.ts
import type { Processor } from 'bullmq'
import TenantContext from '#shared/helpers/tenant_context'
import siopImportService from '#modules/siop/services/siop_import_service'
import jobRunService from '#shared/services/job_run_service'

const handler: Processor = async (job) => {
  const { importId, tenantId, requestId } = job.data
  const runId = await jobRunService.start({
    tenantId,
    jobName: 'siop:import',
    queueName: 'siop',
    bullmqJobId: job.id!,
    bullmqAttempt: job.attemptsMade + 1,
    targetType: 'siop_import',
    targetId: importId,
    origin: 'http',
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

### Camadas de tracking

| Camada           | Storage  | Papel                        | Volátil?                     |
| ---------------- | -------- | ---------------------------- | ---------------------------- |
| BullMQ jobs      | Redis    | Operacional, retry/backoff   | Sim (removeOnComplete: 100)  |
| `radar_job_runs` | Postgres | Histórico do produto p/ user | Não (retention configurável) |
| `audit_logs`     | Postgres | Trilha de compliance/negócio | Não (append-only)            |

### Retry e dead-letter

```
defaults globais:
  removeOnComplete: { count: 100 }
  removeOnFail:     { count: 500 }
  attempts: 3
  backoff: { type: 'exponential', delay: 1000 }

Após attempts esgotados:
  - BullMQ mantém em "failed"
  - radar_job_runs.status = 'failed'
  - /admin/health.failed_jobs_24h++
  - POST /admin/jobs/{runId}/retry (privacy_admin/tenant_admin):
      cria novo radar_job_runs com parent_run_id, run_number=parent.run_number+1
      jobId determinístico inclui run_number
      audit_logs INSERT { action: 'job_retry' }
```

### Cenários catastróficos

```
Redis cai:
  workers param; HTTP responde 503 em endpoints que enfileiram
  /healthz: degraded (sessão Redis crítica)
  Recovery: BullMQ tenta reconectar; jobs voltam quando Redis volta

Postgres lock contention:
  advisory lock impede concurrent siop:import do mesmo arquivo
  chunk transactions curtas (< 5s)
  retry com backoff cuida

SIOP arquivo corrompido:
  exceljs throws → handler captura, status='failed'
  error_code='siop_parse_error', error_message com linha
  user vê em /imports/{id} e baixa source

OOM no worker:
  streaming reader + chunks pequenos previnem
  se acontecer: docker restart, BullMQ re-enfileira (attempt+1)
  3 attempts OOM consecutivas → failed + flag em health
```

## Erros e observabilidade

### Hierarquia de exceções customizadas

```typescript
class DomainException extends Exception {
...
}

class TenantNotResolvedException extends DomainException {
  static status = 401;
  static code = 'E_TENANT_NOT_RESOLVED'
}

class TenantMembershipInactiveException extends DomainException {
  static status = 403;
  static code = 'E_TENANT_MEMBERSHIP_INACTIVE'
}

class PermissionDeniedException extends DomainException {
  static status = 403;
  static code = 'E_PERMISSION_DENIED'
}

class ImportAlreadyExistsException extends DomainException {
  static status = 409;
  static code = 'E_IMPORT_ALREADY_EXISTS'
}

class ImportConcurrentRunException extends DomainException {
  static status = 423;
  static code = 'E_IMPORT_CONCURRENT'
}

class SiopParseException extends DomainException {
  static status = 422;
  static code = 'E_SIOP_PARSE'
}

class PiiRevealForbiddenException extends DomainException {
  static status = 403;
  static code = 'E_PII_REVEAL_FORBIDDEN'
}

class PiiRateLimitExceededException extends DomainException {
  static status = 429;
  static code = 'E_PII_RATE_LIMIT'
}

class ExportInProgressException extends DomainException {
  static status = 202;
  static code = 'E_EXPORT_IN_PROGRESS'
}

class FileTooLargeException extends DomainException {
  static status = 413;
  static code = 'E_FILE_TOO_LARGE'
}

class ChecksumConflictException extends DomainException {
  static status = 409;
  static code = 'E_CHECKSUM_CONFLICT'
}
```

### `mapCodeToMessage` (oficial)

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
```

### Logger config (pino com redaction)

```typescript
// config/logger.ts
export default defineConfig({
  default: 'app',
  loggers: {
    app: {
      level: env.get('LOG_LEVEL', 'info'),
      transport: {
        targets: [
          ...(!app.inProduction ? [targets.pretty()] : []),
          ...(app.inProduction ? [targets.file({ destination: 'storage/logs/app.log' })] : []),
        ],
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

### Eventos padronizados

```
http.request.start    { requestId, method, url, tenantId, userId }
http.request.complete { requestId, status, durationMs }
http.request.failed   { requestId, status, code, errStack }
auth.login.success    { userId, ip }
auth.login.failed     { email_hash, ip, reason }
tenant.switched       { userId, fromTenantId, toTenantId }
job.start             { jobName, jobId, runId, tenantId, attempt }
job.complete          { jobName, jobId, runId, durationMs }
job.failed            { jobName, jobId, runId, attempt, code }
pii.reveal.attempt    { userId, beneficiaryId, requestId }
pii.reveal.success    { userId, beneficiaryId, requestId, accessLogId }
pii.reveal.denied     { userId, beneficiaryId, requestId, reason }
db.query.slow         { sql_hash, durationMs, requestId }
```

### Healthchecks

```
GET /healthz                      → público
  Resposta: { status: 'ok'|'degraded'|'down', checks: { app, db, redis } }
  down      = app ou db indisponível
  degraded  = redis/queue/drive (sessão Redis = degraded crítico)
  ok        = tudo

GET /admin/health                 → autenticado, privacy_admin/tenant_admin
  Sanitizado, sem segredos:
  {
    app: { version, uptime_s, node_version, env },
    db: { status, latency_ms, active_connections, pool_size },
    redis: { status, latency_ms, used_memory_human, connected_clients },
    queues: { 'siop:import': { active, waiting, delayed, failed_24h }, ... },
    workers: [{ worker_id, status: ok|stale|down, last_seen_at }],
    jobs: { last_failed_runs: [...] x10 },
    drive: { status, type: 's3'|'fs' },
    lgpd: { pending_opt_out_requests, last_retention_run_at },
  }

GET /admin/health/live            → 200 sempre
GET /admin/health/ready           → 200 se db ok, redis recomendado; 503 se down
                                    (worker readiness exige redis também)
```

### Frontend error handling

- `inertia/pages/Errors/Show.tsx` — error page Inertia universal
- `<ErrorBoundary />` envolve `<App>` no `app.tsx`
- Errors enviados ao `POST /api/client-errors` com truncamento + sanitização + rate limit

## Testing strategy

### Pirâmide

```
                    E2E (Playwright)         ~10 fluxos vitais
                  ────────────────────
                Functional/HTTP            ~80 testes
              ────────────────────────────
            Integration                  ~120 testes
          ────────────────────────────────
        Unit                            ~200 testes
      ────────────────────────────────────────
```

### Coverage targets v0

- unit: ≥ 85%
- integration: ≥ 70%
- functional: ≥ 60%
- overall: ≥ 70%

Crítico (must-pass na CI, zero tolerância):

- `app/modules/siop/parsers/`
- `app/modules/siop/normalizers/`
- `app/modules/pii/`
- `app/shared/repositories/base_repository.ts`
- `app/shared/helpers/with_tenant_rls.ts`
- `app/shared/middleware/tenant_middleware.ts`

### Suites principais

- **Unit:** parsers (CNJ, valor BR, debtor normalizer), helpers (sanitizeError), validators
- **Integration (DB + Redis real):** siop_import idempotência, match cascade, multi-tenant isolation, RLS PII bunker,
  queue handlers
- **Functional (HTTP + Inertia):** auth flow, tenant_select, imports flow, precatorios list, pii_reveal, exports flow,
  admin/jobs
- **E2E (Playwright):** golden_path (login → upload → ver lista), multi_tenant_switch, error_pages
- **Performance:** import 100k rows em < 10min, list query p95 < 500ms

### CI pipeline

```yaml
jobs:
  lint-and-types:
    - pnpm install
    - pnpm lint
    - pnpm typecheck
  test:
    services: [ postgres, redis ]
      - pnpm ace migration:run --connection=test
      - pnpm test:unit
      - pnpm test:functional
      - pnpm test:integration
  e2e:
    services: [ postgres, redis ]
      - pnpm exec playwright install
      - pnpm test:e2e
  security:
    - pnpm audit --production
```

## Critérios objetivos de aceite — Spec 1 entregue

### INFRA & SETUP

- [ ] `docker-compose up` sobe app + worker + postgres + redis
- [ ] `pnpm dev` funciona com HMR
- [ ] `pnpm build` conclui sem erros TS/lint
- [ ] `pnpm typecheck` (backend + frontend) passa
- [ ] `pnpm lint` passa
- [ ] migrations rodam idempotentemente do zero
- [ ] seeders criam: 1 tenant Benício, roles padrão, permissions, 1 admin user

### DATABASE

- [ ] schema `public.*` completo (35+ tabelas conforme migrations)
- [ ] schema `pii.*` completo (3 tabelas + função `reveal_beneficiary`)
- [ ] RLS habilitado em `pii.*` + `audit_logs` + `security_audit_logs`
- [ ] PG RULES bloqueiam UPDATE/DELETE em `audit_logs`, `pii.access_logs`, `security_audit_logs`
- [ ] todos os índices da seção 7 aplicados
- [ ] materialized views `v_dashboard_metrics`, `v_debtor_aggregates`, `v_asset_yearly_stats` com unique index
- [ ] `retention_config` populada com defaults

### INGESTÃO SIOP

- [ ] importer XLSX/CSV streaming funciona com fixtures
- [ ] todo histórico SIOP federal disponível populado em ambiente local
- [ ] `siop:import` idempotente (mesmo checksum + status completed → 409)
- [ ] re-upload com import pending/running → redirect 200/202 sem novo job
- [ ] re-upload com import failed/partial → permite reprocess
- [ ] `siop:reprocess` funciona em status failed/partial
- [ ] match cascade external_id → cnj_number → row_fingerprint
- [ ] `asset_events` com idempotency_key não duplica em re-import
- [ ] advisory lock previne concurrent runs do mesmo import
- [ ] transações por chunk de 1k-5k (não por row, não em volta de job inteiro)

### DASHBOARD UI

- [ ] `/auth/login` funcional com session.regenerate
- [ ] `/tenants/select` funciona pra users com N memberships
- [ ] `/dashboard` com KPIs e charts (ApexCharts)
- [ ] `/imports` list + new + detail com polling + errors page
- [ ] `/imports/{id}/download-source` (legal_reviewer+, audit log)
- [ ] `/precatorios` list com TanStack Table + filtros server-side + sort whitelist
- [ ] `/precatorios/{id}` detail com tabs (overview, eventos, devedor, beneficiários, audit)
- [ ] `/debtors` list + detail
- [ ] `/admin/health` sanitizado funcional
- [ ] error pages 401/403/404/419/500 customizadas
- [ ] componentes `<EmptyState />`, `<LoadingState />`, `<ErrorState />`, `<DeniedState />`
- [ ] `<SafeJsonView />` redact server-side
- [ ] `useImportPolling` com pause/backoff/visibility

### PII & SECURITY

- [ ] `pii.reveal_beneficiary` SECURITY DEFINER + search_path lock funcional
- [ ] valida: actor membership, permission, beneficiary tenant, asset tenant, opt_out, purpose, justification
- [ ] `RevealDialog` one-shot, JSON efêmero, auto-clear 90s
- [ ] rate limit PII funcional (10/h/user) com 429 + audit
- [ ] tentativas (success/denied) logadas em `pii.access_logs`
- [ ] permissions cache versionado por `rbac_version`
- [ ] redaction de logs configurada e testada
- [ ] CSRF habilitado, x-request-id sanitizado (regex + length)
- [ ] `client_errors` truncamento + regex strip + rate limit

### JOBS & QUEUE

- [ ] BullMQ + Redis configurados (namespace separados: sess/queue/perm/rl)
- [ ] worker process separado funcional (`pnpm start:worker`)
- [ ] todos os 8 handlers registrados em `bootWorkers()`
- [ ] scheduler enfileira jobs (não executa direto)
- [ ] `queue:enqueue` ace command funcional
- [ ] worker heartbeat funciona (Redis + tabela `worker_heartbeats`)
- [ ] retry/backoff/jobId determinístico
- [ ] `radar_job_runs` com `bullmq_attempt`, `run_number`, `parent_run_id`, `origin`
- [ ] `/admin/jobs` read-only paginado
- [ ] `POST /admin/jobs/{runId}/retry` valida tenant + role + status
- [ ] `refresh_aggregates` anti-sobreposição via jobId por slot

### OBSERVABILITY

- [ ] logs estruturados pino com redaction expandido
- [ ] eventos padronizados emitidos
- [ ] `/healthz` (público) e `/admin/health` (privado, sanitizado) funcionais
- [ ] `requestId` propaga HTTP → BullMQ → audit
- [ ] `mapCodeToMessage` tabela completa
- [ ] `sanitizeError` em prod sem stack vazado
- [ ] `audit_logs.payload` validator runtime rejeita PII
- [ ] `security_audit_logs` recebe eventos pré-tenant resolution

### TESTES

- [ ] suite unit ≥ 85% coverage
- [ ] suite integration ≥ 70%
- [ ] suite functional ≥ 60%
- [ ] coverage overall ≥ 70%
- [ ] E2E golden path passa
- [ ] tenant isolation tests passam (TODOS — zero tolerância)
- [ ] PII access tests passam
- [ ] CI verde

### DOCUMENTAÇÃO

- [ ] `README.md` com setup local
- [ ] `AGENTS.md` ou `CLAUDE.md` no padrão eduguard (regras críticas)
- [ ] `docs/schema-overview.md` (entidades + relações)
- [ ] `docs/pii-bunker-policy.md` (base legal, fluxo, retenção, LIA template)
- [ ] `docs/rbac-roles.md` (roles e permissions)
- [ ] `docs/testing-guide.md` (como rodar cada suite)
- [ ] `docs/import-runbook.md` (operação de import + reprocess)
- [ ] OpenAPI/swagger das rotas JSON públicas

## Riscos e considerações

### Operacional

| Risco                                                       | Mitigação                                                                                |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Volume real do SIOP histórico maior que estimado (>2M rows) | Particionamento de `precatorio_assets` por `exercise_year` em Spec 2; índices preparados |
| Memory leak no exceljs em arquivos grandes                  | Streaming reader + chunks; teste de OOM em CI                                            |
| RLS performance degradação em queries grandes               | RLS apenas em `pii.*` + `audit_logs`; queries hot-path no `public.*` usam BaseRepository |
| Cache Redis perde durante deploy                            | Permission cache versionado; perda apenas degrada UX, não quebra                         |

### Compliance/LGPD

| Risco                                | Mitigação                                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------- |
| PII vaza em logs                     | Redaction extensiva configurada + validator runtime no AuditService                          |
| Reveal sem audit                     | Função SECURITY DEFINER faz INSERT antes de retornar — não confia no app                     |
| Stack trace em prod expõe paths/PII  | `sanitizeError` em prod, `error_stack` salvo apenas em dev                                   |
| Bulk export indevido                 | Apenas `privacy_admin` com double-confirmation; rate limit; signed URL TTL 24h               |
| Right-to-be-forgotten (LGPD art. 18) | `pii.beneficiaries.opt_out=true` bloqueia reveal; `retention_until` permite purga programada |

### Negócio

| Risco                              | Mitigação                                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| Fonte SIOP muda formato/colunas    | Parser desacoplado em `siop/parsers/`, fácil refactor; staging preserva raw_data          |
| `external_id` SIOP não estável     | Match cascade com 3 estratégias                                                           |
| Re-import sobrescreve campo manual | Upsert preserva `compliance_status`, `pii_status`; raw_data atualiza                      |
| Score futuro recalcula tudo        | `asset_scores` versionado; `precatorio_assets.current_score_id` aponta pro snapshot atual |

## Próximos passos (após Spec 1)

### Spec 2 — DataJud Enrichment

Recebe assets do Radar Federal e enriquece com metadados/movimentos do DataJud. Inclui:

- Cliente DataJud com rate limiting respeitado (TRF1-6, STJ)
- Cache global em `public_datajud_cache` (sem `tenant_id`)
- Job `datajud:enrich` por asset (concurrency=5)
- Atualiza `judicial_processes` + movimentos
- Score rule-based v1 com sinais do DataJud
- Fila de revisão humana
- Adonis Transmit pra real-time progress
- Deploy em staging

### Spec 3 — DJEN Publications + NLP

Adiciona pipeline em tempo real:

- Cliente DJEN API
- Parser de publicações (texto livre)
- NLP jurídico (extrai eventos: expedição, suspensão, cessão, pagamento)
- Classificação com confidence/threshold
- Vincula publication → asset
- Alertas para legal_reviewer

### Specs 4-9

Conforme decomposição na seção 4.

## Apêndices

### Glossário

- **CNJ**: Numeração Única de Processo (20 dígitos com dígito verificador)
- **Precatório**: requisição de pagamento expedida pelo Judiciário contra ente público após condenação
- **RPV**: Requisição de Pequeno Valor (sub-categoria de precatório)
- **SIOP**: Sistema Integrado de Planejamento e Orçamento (gov.br)
- **DataJud**: Base de Dados do Poder Judiciário (CNJ)
- **DJEN**: Diário da Justiça Eletrônico Nacional
- **EC 136/2025**: Emenda Constitucional que mudou regras de pagamento de precatórios
- **Cessão**: transferência de titularidade de precatório
- **Superpreferência**: prioridade de pagamento (idosos, doentes graves, deficiência) — apenas alimentar
- **LIA**: Legitimate Interest Assessment (LGPD)
- **PII**: Personally Identifiable Information

### Referências regulatórias

- LGPD (Lei 13.709/2018)
- Resolução CNJ nº 303/2019 (organização de precatórios)
- EC 136/2025 (regras de atualização e pagamento)
- Provimento CNJ sobre EC 136/2025 (IPCA + 2% a.a., teto Selic)

---

**Status:** spec aprovado pelo product owner em 2026-04-28 após 9 seções de iteração com ajustes incorporados (
10+7+12+10+10+13+ajustes adicionais por seção).

**Próximo passo:** invocar `superpowers:writing-plans` para gerar o plano de implementação executável.
