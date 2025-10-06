# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] - 2025-10-06

### Changed

- Expanded repository methods and introduced interfaces for `Client`, `Case`, and `Deadline` models ([3e48189](https://github.com/gabrielmaialva33/juridicai/commit/3e48189))
- Improved model consume methods and enhanced tenant context handling ([21f7f08](https://github.com/gabrielmaialva33/juridicai/commit/21f7f08))
- Updated project dependencies for better stability and security ([dbacd82](https://github.com/gabrielmaialva33/juridicai/commit/dbacd82))
- Refactored test suite for improved consistency and better logging ([b137b95](https://github.com/gabrielmaialva33/juridicai/commit/b137b95))
- Restructured and migrated unit tests for better organization ([679aeab](https://github.com/gabrielmaialva33/juridicai/commit/679aeab))
- Cleaned up unused imports from functional user tests ([27c4317](https://github.com/gabrielmaialva33/juridicai/commit/27c4317))

## [0.2.1] - 2025-10-06

### Added

- `TenantContextException` for centralized tenant context error handling ([cb303fb](https://github.com/gabrielmaialva33/juridicai/commit/cb303fb))
- Advanced options and TypeScript support to `withTenantScope` mixin with better configurability ([3f9a94f](https://github.com/gabrielmaialva33/juridicai/commit/3f9a94f))
- Repository pattern implementation for `Client`, `Case`, and `Deadline` models ([8ec9318](https://github.com/gabrielmaialva33/juridicai/commit/8ec9318))

### Changed

- Refactored tenant scoping by introducing reusable `withTenantScope` mixin ([d1d4543](https://github.com/gabrielmaialva33/juridicai/commit/d1d4543))
- Improved type safety in query scopes across multiple models:
  - `User` and `Document` models with improved types and consistency ([0aa1544](https://github.com/gabrielmaialva33/juridicai/commit/0aa1544))
  - `AuditLog` model replacing `any` with `ModelQueryBuilderContract` ([bb5b983](https://github.com/gabrielmaialva33/juridicai/commit/bb5b983))
- Enhanced pagination services with better typings ([8ec9318](https://github.com/gabrielmaialva33/juridicai/commit/8ec9318))
- Refactored factory calls and tests for improved consistency and readability ([001586d](https://github.com/gabrielmaialva33/juridicai/commit/001586d))

### Documentation

- Updated all references from `TenantAwareModel` to `withTenantScope` mixin ([1d4bd26](https://github.com/gabrielmaialva33/juridicai/commit/1d4bd26))
- Enhanced tenant scope mixin documentation for clarity and consistency ([9603bd0](https://github.com/gabrielmaialva33/juridicai/commit/9603bd0))

### Removed

- Outdated design assets from `.github` directory ([7655826](https://github.com/gabrielmaialva33/juridicai/commit/7655826))

## [0.2.0] - 2025-10-05

### Added

- Comprehensive query scopes for Case model: search, status filters (active, archived, closed), priority filters (urgent, byPriority), type and court filters, assignment filters (assignedTo, unassigned), client filtering (forClient), deadline-related scopes (withUpcomingDeadlines, requiresAttention), relationship preloading (withRelationships), aggregate counts (withDeadlinesCount, withDocumentsCount), date and value range filters (createdBetween, valueBetween), and ordering scopes (byPriorityOrder, newest, oldest)
- Comprehensive query scopes for Client model: search by name/CPF/CNPJ/email, type filters (ofType), status filters (active, inactive), case-related filters (withActiveCases, withoutCases, withCases, withCasesCount), location filters (byState, byCity), tag filters (hasTag, hasAnyTag), date filters (createdBetween, createdAfter, createdBefore, recent), and ordering scopes (alphabetical, newest, oldest)
- Comprehensive query scopes for Tenant model: active status filter, plan filters (byPlan, byPlans), domain search (bySubdomain, byCustomDomain), general search, limits monitoring (withLimits, nearLimits), suspension and trial filters (suspended, notSuspended, inTrial, trialExpired), user-related scopes (withUserCount, withUsers), date filters (createdBetween, createdAfter, createdBefore, recentlyCreated), and ordering scopes (newest, alphabetical)
- Comprehensive query scopes for User model: search functionality (searchByTerm), tenant scoping (forTenant), relationship preloading (withRoles, withPermissions, withTenants), status filters (active, verified), role filters (byRole, byRoles), permission filter (withPermission), and date filters (recent, createdInLastDays)

### Changed

- Updated documentation formatting in CHANGELOG.md for better readability ([8c679f9](https://github.com/gabrielmaialva33/juridicai/commit/8c679f9))
- Enhanced guidelines.md formatting for improved readability ([0118822](https://github.com/gabrielmaialva33/juridicai/commit/0118822))
- Updated README.md with refreshed badges, configuration details, and technology stack ([ac1b5e8](https://github.com/gabrielmaialva33/juridicai/commit/ac1b5e8))
- Upgraded xlsx dependency to latest version ([a3296cd](https://github.com/gabrielmaialva33/juridicai/commit/a3296cd))
- Updated license to proprietary ([a3296cd](https://github.com/gabrielmaialva33/juridicai/commit/a3296cd))

### Deprecated

- User model's `includeRoles` method (use `withScopes(s => s.withRoles())` instead)

## [0.1.0] - 2025-10-05

### Added

- Multi-tenant architecture with tenant-aware models and context service ([631b99e](https://github.com/gabrielmaialva33/juridicai/commit/631b99e))
- Case management system with models for cases, clients, events, documents, and deadlines ([1f3850d](https://github.com/gabrielmaialva33/juridicai/commit/1f3850d))
- Database factories and seeders for multi-tenant setup ([ac80dbb](https://github.com/gabrielmaialva33/juridicai/commit/ac80dbb))
- Enhanced tenant scoping with `forTenant` and `withoutTenantScope` query scopes ([5318f32](https://github.com/gabrielmaialva33/juridicai/commit/5318f32))
- Database debug configuration options with pretty-printing support ([af65a4a](https://github.com/gabrielmaialva33/juridicai/commit/af65a4a), [e17b1e5](https://github.com/gabrielmaialva33/juridicai/commit/e17b1e5), [9b714cb](https://github.com/gabrielmaialva33/juridicai/commit/9b714cb))
- Comprehensive unit tests for tenant services ([05bc1bc](https://github.com/gabrielmaialva33/juridicai/commit/05bc1bc))

### Changed

- Enhanced tenant and user handling with role and permission updates using enums ([55e5a5d](https://github.com/gabrielmaialva33/juridicai/commit/55e5a5d))
- Introduced `ConflictException` for handling 409 errors ([a8b7492](https://github.com/gabrielmaialva33/juridicai/commit/a8b7492))
- Implemented tenant-specific handling and pagination improvements ([705ef79](https://github.com/gabrielmaialva33/juridicai/commit/705ef79))
- Replaced `AuditService` with `LogPermissionCheckService` for improved consistency ([fc85d78](https://github.com/gabrielmaialva33/juridicai/commit/fc85d78))
- Updated workflows to use main branch with upgraded service images ([1f19833](https://github.com/gabrielmaialva33/juridicai/commit/1f19833))
- Improved code consistency and formatting across models, migrations, and documentation ([004bdf1](https://github.com/gabrielmaialva33/juridicai/commit/004bdf1), [29aaa73](https://github.com/gabrielmaialva33/juridicai/commit/29aaa73))
- Replaced dynamic imports with static imports in test files ([5e107f5](https://github.com/gabrielmaialva33/juridicai/commit/5e107f5))

### Documentation

- Added comprehensive project development guidelines covering setup, testing, and architecture ([f3979a0](https://github.com/gabrielmaialva33/juridicai/commit/f3979a0))
- Expanded README with detailed multi-tenant principles and quick start guides ([359c4a8](https://github.com/gabrielmaialva33/juridicai/commit/359c4a8))
- Rebranded project as JuridicAI with focus on legal multi-tenant SaaS ([94127dd](https://github.com/gabrielmaialva33/juridicai/commit/94127dd))
- Refined documentation formatting for better clarity and readability ([75cea51](https://github.com/gabrielmaialva33/juridicai/commit/75cea51), [aec8965](https://github.com/gabrielmaialva33/juridicai/commit/aec8965))

[0.1.0]: https://github.com/gabrielmaialva33/juridicai/releases/tag/v0.1.0
