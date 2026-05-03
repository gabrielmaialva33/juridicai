# Test Organization

Tests are grouped first by suite and then by domain.

```txt
tests/
├── unit/
│   ├── integrations/
│   │   ├── coverage/       # Coverage runs, source quality and evidence metrics
│   │   ├── datajud/        # DataJud adapters, enrichment, candidates and signals
│   │   ├── djen/           # DJEN publication ingestion and signal classification
│   │   ├── government/     # National orchestration, coverage matrix and recovery plans
│   │   ├── siop/           # SIOP open-data integration adapters
│   │   └── tribunals/      # Tribunal adapters/importers, grouped by court or shared core
│   ├── operations/         # Cession, pricing, pipeline and operational intake
│   ├── market/             # Market-rate calculations
│   ├── siop/               # SIOP import and parser domain tests
│   └── shared/             # Cross-module helpers and filters
└── functional/
    └── routes/             # Authenticated HTTP/API route flows
```

Place new specs next to the domain they exercise. Prefer `.spec.ts` filenames that
match the service, adapter, handler or route under test. Keep database-heavy HTTP
flows in `functional/routes`; keep service-level database tests in `unit/<domain>`.
