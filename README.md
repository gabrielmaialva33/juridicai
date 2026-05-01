<div align="center">

<img src=".github/assets/readme-hero.svg" alt="JuridicAI - Radar Federal Base" width="100%"/>

**Public records become governed legal intelligence.**

<p>
  <a href="https://adonisjs.com/"><img src="https://img.shields.io/badge/AdonisJS-7.3-5a45ff?style=flat-square&labelColor=08111f" alt="AdonisJS 7.3"/></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-38bdf8?style=flat-square&labelColor=08111f" alt="React 19"/></a>
  <a href="https://docs.timescale.com/"><img src="https://img.shields.io/badge/TimescaleDB-PG17-42d392?style=flat-square&labelColor=08111f" alt="TimescaleDB PG17"/></a>
  <a href="https://docs.bullmq.io/"><img src="https://img.shields.io/badge/BullMQ-Redis-f5c451?style=flat-square&labelColor=08111f" alt="BullMQ and Redis"/></a>
  <a href="./docs/superpowers/specs/2026-04-28-radar-federal-base-design.md"><img src="https://img.shields.io/badge/spec-SPEC--001-9d7cff?style=flat-square&labelColor=08111f" alt="SPEC-001"/></a>
  <a href="./package.json"><img src="https://img.shields.io/badge/license-UNLICENSED-e879f9?style=flat-square&labelColor=08111f" alt="UNLICENSED"/></a>
</p>

---

_"We do not sell lists of people. We qualify judicial assets with public data, legal-financial scoring, and commercial governance."_

</div>

---

> [!IMPORTANT]
> **Tenant-safe by default.** Domain data is modeled around `tenant_id`, shared access goes through repository boundaries, and sensitive surfaces use PostgreSQL RLS. PII is isolated under `pii.*`, encrypted at rest, revealed through controlled database functions, and audited on every access.

> [!NOTE]
> **SPEC-001 scope.** This foundation is SIOP-only: import, normalize, deduplicate, inspect, and audit federal precatorio history. DataJud, DJEN, CRM, pricing, court crawlers, production deployment, and full scoring engines are future specs.

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Create local environment
cp .env.example .env
node ace generate:key

# Start TimescaleDB/PostgreSQL 17 and Redis
docker compose up -d

# Prepare the database
node ace migration:run

# Run the Adonis + Inertia development server
pnpm dev
```

The default app URL is `http://localhost:3333`. Local services bind to `127.0.0.1:5432` for PostgreSQL and `127.0.0.1:6379` for Redis.

---

## Architecture

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {
  'fontFamily': 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  'lineColor': '#64748b',
  'primaryTextColor': '#111827',
  'clusterBkg': '#f8fafc',
  'clusterBorder': '#94a3b8'
}}}%%
flowchart LR
    subgraph Sources["Public Sources"]
        SIOP["SIOP XLSX / CSV"]
    end

    subgraph Radar["Radar Module"]
        SOURCE["source_records<br/>immutable provenance"]
        IMPORTS["siop_imports<br/>batch control"]
        STAGING["siop_staging_rows<br/>raw rows + errors"]
        NORMALIZE["normalizers<br/>CNJ, value, debtor"]
    end

    subgraph Domain["Legal Asset Model"]
        DEBTORS["debtors"]
        ASSETS["precatorio_assets"]
        EVENTS["asset_events"]
        SCORES["asset_scores"]
        JUDICIAL["judicial_processes<br/>publications"]
    end

    subgraph Governance["Governance Layer"]
        TENANTS["tenants<br/>memberships"]
        RBAC["roles<br/>permissions"]
        PII["pii.* bunker<br/>pgcrypto + RLS"]
        AUDIT["audit logs<br/>append-only"]
    end

    subgraph Product["Product Surfaces"]
        VIEWS["materialized views"]
        DASHBOARD["Inertia dashboard"]
        EXPORTS["exports"]
        JOBS["radar_job_runs<br/>worker heartbeats"]
    end

    SIOP --> SOURCE --> IMPORTS --> STAGING --> NORMALIZE
    NORMALIZE --> DEBTORS
    NORMALIZE --> ASSETS
    ASSETS --> EVENTS
    ASSETS --> SCORES
    ASSETS --> JUDICIAL
    TENANTS -.-> DEBTORS
    TENANTS -.-> ASSETS
    RBAC -.-> DASHBOARD
    PII -.-> ASSETS
    AUDIT -.-> PII
    ASSETS --> VIEWS --> DASHBOARD
    ASSETS --> EXPORTS
    IMPORTS --> JOBS

    classDef source fill:#e7edff,stroke:#4f46e5,color:#151a33,stroke-width:2px;
    classDef domain fill:#dff7ea,stroke:#0b7a3b,color:#102015,stroke-width:2px;
    classDef governance fill:#ffe5e8,stroke:#be123c,color:#3b1015,stroke-width:2px;
    classDef product fill:#fff3cc,stroke:#b45309,color:#332400,stroke-width:2px;

    class SIOP,SOURCE,IMPORTS,STAGING,NORMALIZE source;
    class DEBTORS,ASSETS,EVENTS,SCORES,JUDICIAL domain;
    class TENANTS,RBAC,PII,AUDIT governance;
    class VIEWS,DASHBOARD,EXPORTS,JOBS product;
```

---

## Components

| Component                     | Role                                                | Key Constraint                                   |
| :---------------------------- | :-------------------------------------------------- | :----------------------------------------------- |
| **`app/modules/siop`**        | SIOP import pipeline, parsers, jobs, staging        | Idempotent imports with immutable source records |
| **`app/modules/precatorios`** | Legal asset domain model and repositories           | Tenant-scoped reads and writes                   |
| **`app/modules/debtors`**     | Debtor normalization and lookup                     | Shared debtor identity per tenant                |
| **`app/modules/pii`**         | PII bunker models, reveal services, policies        | No PII in page props or logs                     |
| **`app/modules/auth`**        | Session auth, users, tokens                         | Argon2id password hashing                        |
| **`app/modules/tenant`**      | Tenants and memberships                             | One active tenant per session in v0              |
| **`app/modules/permission`**  | RBAC tables and permission services                 | Backend enforcement with Bouncer                 |
| **`app/modules/dashboard`**   | Read-only aggregates and dashboard services         | Materialized views for heavy metrics             |
| **`app/modules/exports`**     | Export jobs and export records                      | Queue-backed, audited output                     |
| **`app/shared`**              | Base models, repositories, helpers, shared services | Cross-domain code only                           |

---

## Ingestion Pipeline

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {
  'fontFamily': 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  'lineColor': '#64748b',
  'primaryTextColor': '#111827'
}}}%%
flowchart LR
    UPLOAD["1. Upload SIOP file"] --> STORE["2. Store raw file<br/>Drive"]
    STORE --> PROVENANCE["3. Create source_record"]
    PROVENANCE --> STAGE["4. Insert staging rows"]
    STAGE --> VALIDATE["5. Validate row shape"]
    VALIDATE --> NORMALIZE["6. Normalize CNJ, debtor, values"]
    NORMALIZE --> UPSERT["7. Deduplicate and upsert assets"]
    UPSERT --> EVENTS["8. Record events and job run"]
    EVENTS --> AGGREGATE["9. Refresh dashboard aggregates"]

    ERRORS["Row errors"] -.-> STAGE
    AUDIT["Audit trail"] -.-> PROVENANCE
    AUDIT -.-> UPSERT
    WORKER["BullMQ worker"] -.-> VALIDATE
    WORKER -.-> NORMALIZE
    WORKER -.-> AGGREGATE

    classDef step fill:#dff7ea,stroke:#0b7a3b,color:#102015,stroke-width:2px;
    classDef side fill:#e7edff,stroke:#4f46e5,color:#151a33,stroke-width:2px;
    classDef audit fill:#fff3cc,stroke:#b45309,color:#332400,stroke-width:2px;

    class UPLOAD,STORE,PROVENANCE,STAGE,VALIDATE,NORMALIZE,UPSERT,EVENTS,AGGREGATE step;
    class ERRORS,WORKER side;
    class AUDIT audit;
```

**Pipeline rules:**

- Raw source rows stay traceable through `source_records`.
- Import runs are product history, not only queue metadata.
- Staging can fail per row without losing the batch.
- Domain writes must preserve tenant isolation.
- PII reveal is an explicit, audited action.

---

## Data Governance

| Surface           | Protection                                                                                                             |
| :---------------- | :--------------------------------------------------------------------------------------------------------------------- |
| **Multi-tenancy** | Business tables carry `tenant_id`; shared repositories apply tenant scope.                                             |
| **PII bunker**    | Sensitive beneficiary data lives in `pii.*`, with encrypted `bytea` fields and RLS policies.                           |
| **Reveal flow**   | `pii.reveal_beneficiary()` decrypts through a controlled `SECURITY DEFINER` function and logs the access.              |
| **Audit logs**    | `audit_logs`, `security_audit_logs`, and `pii.access_logs` are Timescale hypertables with append-only mutation guards. |
| **Hashing**       | Beneficiary lookup uses peppered hashes; user passwords use Argon2id.                                                  |
| **Logging**       | Pino redaction masks secrets, credentials, tokens, and known PII paths.                                                |

---

## Project Structure

```text
juridicai/
├── app/
│   ├── modules/
│   │   ├── auth/                 # Session auth, users, tokens
│   │   ├── tenant/               # Tenant and membership flows
│   │   ├── permission/           # RBAC models and services
│   │   ├── siop/                 # Import controllers, jobs, parsers, services
│   │   ├── precatorios/          # Legal asset models and repositories
│   │   ├── debtors/              # Debtor models and services
│   │   ├── pii/                  # PII bunker services and policies
│   │   ├── exports/              # Export jobs and records
│   │   ├── dashboard/            # Read-only product metrics
│   │   ├── admin/                # Admin and health surfaces
│   │   ├── healthcheck/          # Public health endpoints
│   │   ├── client_errors/        # Browser/client error intake
│   │   └── maintenance/          # Retention, aggregate, and worker jobs
│   └── shared/
│       ├── helpers/              # Tenant context, RLS, redaction, timing
│       ├── models/               # Tenant base models
│       ├── repositories/         # Tenant-aware base repository
│       ├── services/             # Cross-domain services
│       └── types/                # Shared TypeScript contracts
├── config/                       # Adonis, database, Redis, Drive, logger config
├── database/
│   ├── migrations/               # Ordered Radar Federal schema migrations
│   └── factories/                # Japa/Lucid factories for domain models
├── docs/superpowers/
│   ├── specs/                    # Product and architecture specs
│   └── plans/                    # Implementation plans
├── inertia/                      # Inertia + React pages, layouts, CSS
├── start/                        # Routes, middleware, env validation
├── tests/                        # Japa bootstrap and suites
├── docker-compose.yml            # TimescaleDB HA PG17 + Redis
└── package.json                  # Scripts, aliases, runtime dependencies
```

---

## Build & Operations

<details>
<summary><strong>Prerequisites</strong></summary>

| Tool       | Version                                             |
| :--------- | :-------------------------------------------------- |
| Node.js    | `>= 24.0.0`                                         |
| pnpm       | `>= 10.0.0`                                         |
| Docker     | Required for local PostgreSQL/TimescaleDB and Redis |
| PostgreSQL | TimescaleDB HA image on PG17 for local development  |
| Redis      | Redis 7 for sessions and queue-backed work          |

</details>

```bash
# Development server with HMR
pnpm dev

# Production build
pnpm build

# TypeScript checks for backend and Inertia
pnpm typecheck

# ESLint
pnpm lint

# Japa test suite
pnpm test

# List registered routes
node ace list:routes

# Database lifecycle
node ace migration:run
node ace migration:rollback
node ace migration:fresh
node ace db:seed
```

### Environment

Start from `.env.example`. The required local variables are:

| Variable             | Purpose                                                            |
| :------------------- | :----------------------------------------------------------------- |
| `APP_KEY`            | Adonis encryption/session key generated by `node ace generate:key` |
| `DB_*`               | PostgreSQL connection to the TimescaleDB container                 |
| `REDIS_*`            | Redis connection used by sessions and worker infrastructure        |
| `PII_HASH_PEPPER`    | Pepper for beneficiary hash generation                             |
| `PII_ENCRYPTION_KEY` | Key used by PII reveal/decrypt flows                               |
| `DRIVE_DISK`         | Local Drive disk, defaults to `fs`                                 |

---

## Current Foundation

| Area              | Status                                                                                                  |
| :---------------- | :------------------------------------------------------------------------------------------------------ |
| **Runtime stack** | AdonisJS 7, Inertia 4, React 19, Lucid 22, PostgreSQL, Redis, Drive, Bouncer                            |
| **Security**      | Argon2id hashing, logger redaction, tenant context helpers, RLS helpers                                 |
| **Database**      | Ordered schema migrations for tenancy, RBAC, SIOP, assets, PII, audit, jobs, exports, views             |
| **TimescaleDB**   | Hypertables for audit logs, security logs, PII access logs, job runs, and worker heartbeats             |
| **Modules**       | Domain folders under `app/modules/*` with controllers, models, repositories, services, jobs, validators |
| **Factories**     | Lucid factories for tenants, users, RBAC, SIOP, assets, PII, audit, jobs, and exports                   |

---

## Development Rules

- Keep code, comments, and developer-facing strings in English.
- Prefer Ace generators for Adonis artifacts: `node ace make:model`, `make:controller`, `make:migration`, `make:factory`.
- Put domain code in `app/modules/<domain>/`; put reusable cross-domain code in `app/shared/`.
- Use aliases such as `#modules/*` and `#shared/*` instead of deep relative imports.
- Never expose raw PII in Inertia props, logs, exceptions, or exports.
- Run `pnpm typecheck` and `pnpm lint` before committing implementation work.

---

## Roadmap

| Spec          | Scope                                                                     |
| :------------ | :------------------------------------------------------------------------ |
| **SPEC-001**  | Radar Federal Base: SIOP import, dashboard, tenant foundation, PII bunker |
| **SPEC-002**  | DataJud enrichment and deeper legal intelligence                          |
| **SPEC-003**  | DJEN publications and NLP extraction                                      |
| **SPEC-004+** | Scoring, CRM/Sales, pricing, tribunal crawlers, production observability  |

---

## License

This repository is currently private and marked `UNLICENSED` in `package.json`.

---

<div align="center">

<img src=".github/assets/readme-footer.svg" alt="Built for evidence, governance, and tenant-safe legal intelligence." width="100%"/>

</div>
