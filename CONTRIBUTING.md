# Contributing

Thanks for helping improve JuridicAI. This repository is an AdonisJS 7 monolith with Inertia + React, TimescaleDB/PostgreSQL, Redis, queue workers, and public-data ingestion pipelines for precatórios.

## Development Setup

1. Install Node.js `>=24` and pnpm `>=10`.
2. Start local services:

```bash
docker compose up -d
```

3. Install dependencies:

```bash
pnpm install
```

4. Run migrations:

```bash
node ace migration:run
```

5. Start the app:

```bash
pnpm dev
```

## Working Style

- Keep code, comments, logs, and developer-facing strings in English.
- Use `app/modules/<domain>/` for domain code and `app/shared/` for cross-domain utilities.
- Prefer Adonis aliases such as `#modules/*`, `#shared/*`, and `#database/*`.
- Use `DateTime` from Luxon for date/time values in backend code.
- Keep migrations cohesive. This project is still pre-release, so schema improvements should be folded into create migrations when appropriate.
- Treat PII, secrets, court data, and source evidence with care. Do not log sensitive payloads.

## Validation

Run the relevant focused test first, then the broader checks before opening a PR:

```bash
pnpm format
pnpm typecheck
pnpm lint
pnpm test
```

For a focused Japa file:

```bash
pnpm test --files=tests/unit/integrations/tjma_precatorio_adapter.spec.ts
```

## Commit Guidelines

Use concise, scoped Conventional Commit style. The local history often uses gitmoji:

```text
🚀 feat(tjma): add precatorio public PDF sync
🔧 chore(deps): add xlsx dependency
🐛 fix(datajud): normalize court aliases
```

Prefer small commits that each leave the backend in a valid state.

## Pull Requests

PRs should include:

- Summary of the change and why it matters.
- Validation commands run.
- Migration notes, if schema or bootstrap data changed.
- Screenshots for Inertia UI changes.
- Links to related issues, specs, or government data sources.

Do not include secrets, production dumps, private keys, or raw PII in issues, commits, screenshots, or PR descriptions.
