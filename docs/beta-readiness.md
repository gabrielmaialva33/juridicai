# Beta Readiness

This checklist keeps the beta focused on the legal office workflow, not internal tooling.

## Demo Workspace

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
