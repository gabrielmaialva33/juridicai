# Beta Readiness

This checklist keeps the beta focused on the legal office workflow, not internal tooling.

## Production Bootstrap

Production runs migrations only. Do not depend on seeders for beta data.

```bash
node ace migration:run --force
pnpm build
pnpm start
pnpm worker
```

The migration bootstrap creates the minimum operational catalog: local beta workspace, default
`@juridicai.local` users, roles, permissions, role assignments, and retention policies. Real data
population then comes from scheduled jobs and manual sync commands.

Required runtime services:

- PostgreSQL/TimescaleDB 17
- Redis for BullMQ queues
- `DATAJUD_API_KEY` configured with the current CNJ public API key
- `pnpm worker` running continuously
- Scheduler process enabled with the HTTP app

Default bootstrap users use password `Juridicai!2026` and must be rotated or disabled before a
public beta:

| Email                      | Role                    |
| -------------------------- | ----------------------- |
| `owner@juridicai.local`    | Sócio gestor            |
| `advogado@juridicai.local` | Advogado responsável    |
| `operador@juridicai.local` | Operador de atendimento |
| `analyst@juridicai.local`  | Analista jurídico       |

## Real Data Jobs

The beta must rely on public source ingestion:

- `government-data-sync-orchestrator`: tenant-level daily cycle that coordinates SIOP discovery,
  DataJud national discovery, asset enrichment, and candidate matching.
- `datajud-national-precatorio-sync`: scans all official DataJud court aliases for CNJ class
  `1265` (Precatório) and `1266` (Requisição de Pequeno Valor), using `search_after`
  pagination and persisting raw process payloads plus normalized subjects, movements, and
  movement complements.
- `siop-open-data-sync`: discovers SIOP open-data files, downloads official annual files, creates
  pending imports, and enqueues SIOP processing jobs.
- `siop-imports`: parses downloaded SIOP files into source records, debtors, assets, scores, and
  events.
- `datajud-enrich-assets`: enriches assets through CNJ DataJud per inferred court alias.
- `datajud-legal-signal-classifier`: converts normalized DataJud movements and movement
  complements into legal signals such as requisition issued, payment available, prior cession,
  lien, suspension, objection, and superpreference. Linked processes are projected into
  `asset_events` for pricing and advisory, then recompute `legal-signals-v1` score snapshots.
- `tribunal-source-sync`: reads the national `government_source_targets` registry and executes
  implemented adapters such as TJSP communications, TRF2 chronological files, DataJud court
  discovery, and DJEN publication discovery. Targets without stable adapters remain tracked as
  coverage gaps instead of disappearing from the roadmap.
- `siop-reconcile`: marks stale imports as failed for operator visibility.

National discovery starts from DataJud metadata across federal, state, labor, electoral, military,
and superior court aliases. Federal financial data starts from SIOP open data. State and municipal
financial coverage is incremental per tribunal adapter because each court publishes lists in a
different format, often CSV, XLS, XLSX, PDF, HTML, or dashboard exports.

For a new production workspace, run an initial controlled national scan:

```bash
node ace government:sync-data --tenant-id=<tenant-id> --years=2026,2027 --datajud-page-size=100 --datajud-max-pages-per-court=1
```

For targeted troubleshooting, run individual phases:

```bash
node ace datajud:sync-precatorios --tenant-id=<tenant-id> --courts=tjsp --page-size=100 --max-pages-per-court=1 --run-inline
node ace datajud:classify-signals --tenant-id=<tenant-id> --limit=2000 --run-inline
node ace tribunal:sync-sources --tenant-id=<tenant-id> --adapters=tjsp_precatorio_sync,trf2_precatorio_sync --run-inline
node ace tribunal:sync-sources --tenant-id=<tenant-id> --datasets=court-annual-map-pages --dry-run --run-inline
```

Increase `--max-pages-per-court` gradually after checking job duration, DataJud response stability,
and database growth.

## Development Demo Workspace

Run a clean local beta database with:

```bash
docker compose up -d
psql "$DATABASE_URL" -c "drop schema if exists pii cascade"
node ace migration:fresh --drop-views --drop-types
pnpm dev
```

The `pii` schema cleanup is only needed when reusing a local database because Adonis fresh drops
tables, views, and types but does not drop custom schemas. Do not run seeders for beta validation.

## Golden Path

Validate this path before inviting beta users:

1. Login and auto-select the Benício Capital workspace.
2. Open `Painel do Escritório` and confirm KPIs are populated.
3. Open `Triagem de Créditos` and inspect A/A+ credits.
4. Open a credit dossier and review `Cenários para o cliente`.
5. Adjust `Cálculo de referência` and click `Salvar cálculo`.
6. Click `Enviar para acompanhamento`.
7. Move the card in `Acompanhamento` and refresh the page.
8. Generate the liquidity dossier preview.

## Release Checks

Run before a beta build:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Also verify that sensitive beneficiary data remains behind the audited reveal flow, raw government payloads do not expose PII in normal views, and non-owner users cannot access admin-only routes directly.
