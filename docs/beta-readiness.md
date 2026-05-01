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

Create the first account through `/signup`. The signup flow creates the user, workspace tenant,
owner role assignment, permissions catalog, and active tenant session. Real data population then
comes from scheduled jobs.

Required runtime services:

- PostgreSQL/TimescaleDB 17
- Redis for BullMQ queues
- `pnpm worker` running continuously
- Scheduler process enabled with the HTTP app

## Real Data Jobs

The beta must rely on public source ingestion:

- `siop-open-data-sync`: discovers SIOP open-data files, downloads official annual files, creates
  pending imports, and enqueues SIOP processing jobs.
- `siop-imports`: parses downloaded SIOP files into source records, debtors, assets, scores, and
  events.
- `datajud-enrich-assets`: enriches assets through CNJ DataJud per inferred court alias.
- `siop-reconcile`: marks stale imports as failed for operator visibility.

Federal data starts from SIOP open data. State and municipal coverage is incremental per tribunal
adapter because each court publishes lists in a different format.

## Development Demo Workspace

Run a clean local beta database with:

```bash
docker compose up -d
node ace migration:fresh --drop-views --drop-types --seed
pnpm dev
```

Seeded users share the same password: `Juridicai!2026`.

| Email                      | Role                    | Use case                           |
| -------------------------- | ----------------------- | ---------------------------------- |
| `owner@juridicai.local`    | Sócio gestor            | Full beta review and configuration |
| `advogado@juridicai.local` | Advogado responsável    | Client-facing legal analysis       |
| `operador@juridicai.local` | Operador de atendimento | Follow-up, stages, and deadlines   |
| `analyst@juridicai.local`  | Analista jurídico       | Research and supporting checks     |

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
