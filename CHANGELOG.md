# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
