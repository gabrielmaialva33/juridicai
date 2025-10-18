# JuridicAI Project Overview for Gemini

This document provides a comprehensive overview of the JuridicAI project, designed to serve as instructional context for the Gemini CLI agent.

## 1. Project Overview

**JuridicAI** is a modern, multi-tenant SaaS platform built with **AdonisJS v6** (Node.js/TypeScript) for law firm management. It provides complete data isolation for each tenant (law firm), enabling secure management of clients, legal cases, deadlines, documents, and team collaboration.

### Key Features:
- **Row-Level Multi-Tenancy**: Complete data isolation with automatic query scoping via `withTenantScope` mixin.
- **Brazilian Legal Domain**: Includes CPF/CNPJ validation, CNJ case number formatting, and compliance-ready audit trails.
- **AsyncLocalStorage Context**: Tenant context preserved across async operations, including background jobs.
- **Robust Stack**: Utilizes PostgreSQL for production, Redis for caching and queues, and pnpm as the package manager.
- **Type-Safe**: Full TypeScript coverage with a snake_case ORM strategy.
- **Flexible Storage**: Supports local filesystem, AWS S3, and Google Cloud Storage.

### Architecture Highlights:
The architecture is structured into API, Business, and Data layers, with a strong emphasis on a Multi-Tenant Core that ensures data isolation through `AsyncLocalStorage Context`, `Auto Query Scopes`, and `Row-Level Isolation`.

## 2. Building and Running

### Prerequisites:
- **Node.js**: v18 or higher
- **pnpm**: Recommended package manager
- **PostgreSQL**: v14 or higher
- **Redis**: For caching and queue management
- **Docker**: (Optional) for containerized development

### Installation & Setup:
1.  **Clone the repository**:
    ```bash
    git clone https://github.com/gabrielmaialva33/juridicai.git
    cd juridicai
    ```
2.  **Install dependencies**:
    ```bash
    pnpm install
    ```
3.  **Environment configuration**:
    ```bash
    cp .env.example .env
    node ace generate:key
    ```
    (Ensure `APP_KEY` is generated and set in `.env`)
4.  **Database setup**:
    ```bash
    createdb juridicai_dev
    node ace migration:run
    node ace db:seed # Optional: Seed development data
    ```
5.  **Start Redis**:
    ```bash
    # Using Docker
    docker run -d -p 6379:6379 redis:alpine
    # Or install and start locally
    # redis-server
    ```

### Running the Application:
-   **Development with HMR**:
    ```bash
    pnpm dev
    ```
    (Access at `http://localhost:3333`)
-   **Production build and start**:
    ```bash
    pnpm build
    pnpm start
    ```

### Testing:
-   **Run unit tests**:
    ```bash
    pnpm test
    ```
-   **Run all tests (unit + functional/E2E)**:
    ```bash
    pnpm test:e2e
    ```

### Code Quality:
-   **Linting**:
    ```bash
    pnpm lint
    pnpm lint:fix # Auto-fix issues
    ```
-   **Formatting**:
    ```bash
    pnpm format
    ```
-   **TypeScript type checking**:
    ```bash
    pnpm typecheck
    ```

## 3. Development Conventions

### AdonisJS Ace Commands:
The project heavily relies on AdonisJS Ace commands for generating boilerplate code:
-   `node ace make:model Client -m`
-   `node ace make:controller clients/clients_controller --resource`
-   `node ace make:service clients/create_client_service`
-   `node ace make:validator CreateClientValidator`
-   `node ace make:test clients/create_client --suite=functional`
-   `node ace make:factory Client`
-   `node ace make:job SendEmailJob`

### Import Aliases:
The project uses `#` prefixed import aliases for cleaner imports, defined in `package.json`. Examples:
-   `import User from '#models/user'`
-   `import TenantContextService from '#services/tenants/tenant_context_service'`

### Multi-Tenancy Implementation:
-   **`withTenantScope` Mixin**: Models extend a `withTenantScope` mixin for automatic tenant isolation.
-   **Tenant Context**: `TenantContextService.run()` is used to execute code within a specific tenant's context.
-   **HttpContext Fallback**: A fallback to `X-Tenant-Id` header is implemented for scenarios where `AsyncLocalStorage` context is unavailable (e.g., background jobs, CLI commands).

### Data Handling:
-   **JSONB/ARRAY Handling**: Models include specific `prepare` and `consume` functions for JSONB fields to correctly handle data serialization and deserialization from PostgreSQL.
-   **Indexing Strategy**: All tenant-scoped tables use composite indexes (e.g., `tenant_id`, `tenant_id, email`) for optimized query performance.

### Testing Practices:
-   Tests are organized into `unit` and `functional` suites.
-   Comprehensive tests verify tenant isolation and prevent cross-tenant data access.

### Security and Performance:
-   **Security Checklist**: Includes measures like `withTenantScope` on all models, explicit `withoutTenantScope()` for admin operations, CSRF protection, rate limiting, and Argon2 hashing.
-   **Performance Tips**: Emphasizes efficient query scopes, Redis caching, background jobs for heavy tasks, eager loading, and pagination.

## 4. Project Structure

```
juridicai/
├── app/                        # Application code
│   ├── controllers/           # HTTP controllers (organized by domain)
│   ├── events/                # Event definitions
│   ├── exceptions/            # Custom exceptions
│   ├── extensions/            # Framework extensions
│   ├── interfaces/            # TypeScript interfaces
│   ├── middleware/            # HTTP middleware
│   ├── models/                # Database models (Lucid ORM, all use withTenantScope)
│   ├── repositories/          # Data access layer
│   ├── routes/                # Route definitions
│   ├── services/              # Business logic services
│   ├── shared/                # Shared utilities
│   └── validators/            # Request validators (VineJS)
├── bin/                       # Entry point scripts (e.g., server.js)
├── commands/                  # Custom Ace commands
├── config/                    # Configuration files (app, auth, database, etc.)
├── database/                  # Database related files (migrations, seeders, factories)
├── docs/                      # Project documentation
├── providers/                 # Service providers
├── resources/                 # Frontend resources (lang, views)
├── start/                     # Application bootstrap (kernel, routes)
├── storage/                   # File storage (local)
├── tests/                     # Test files (functional, unit, utils)
├── tmp/                       # Temporary files
├── types/                     # TypeScript type definitions
├── .env.example              # Environment variables template
├── ace.js                    # Ace CLI entry point
├── adonisrc.ts               # AdonisJS configuration
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
└── vite.config.ts            # Vite configuration
```
