# Repository Guidelines

## Project Structure & Module Organization

This is an AdonisJS 7 monolith with Inertia + React. Backend code lives in `app/`, with starter folders such as `app/controllers`, `app/models`, `app/middleware`, and `app/validators`. New domain code should use `app/modules/<domain>/`; shared cross-domain code belongs in `app/shared/`.

Configuration lives in `config/`, boot files in `start/`, providers in `providers/`, and database code in `database/`. Frontend pages, layouts, and assets live in `inertia/`. Tests are configured through `tests/bootstrap.ts` and should use suite folders such as `tests/unit`, `tests/functional`, and `tests/browser`. Plans and specs live in `docs/superpowers/`.

## Build, Test, and Development Commands

- `pnpm dev`: start the Adonis development server with HMR.
- `pnpm build`: compile frontend assets and TypeScript for production.
- `pnpm test`: run Japa test suites.
- `pnpm lint`: run ESLint using `@adonisjs/eslint-config`.
- `pnpm format`: format files with Prettier.
- `pnpm typecheck`: run backend and Inertia TypeScript checks.
- `docker compose up -d`: start local TimescaleDB/PostgreSQL 17 and Redis.

Use Ace generators for framework artifacts, for example `node ace make:controller ImportController`, `node ace make:model Tenant`, and `node ace make:migration create_tenants_table`.

## Coding Style & Naming Conventions

Use TypeScript and ESM imports. Keep code, comments, and developer-facing strings in English. Follow `.editorconfig`: 2-space indentation, LF endings, UTF-8, and trailing whitespace trimmed except in Markdown. Prefer Adonis aliases like `#controllers/*`, `#models/*`, `#modules/*`, and `#shared/*` over deep relative imports.

Use snake_case filenames for Adonis-style files (`tenant_middleware.ts`, `hash_service.ts`) and PascalCase for React component exports.

## Testing Guidelines

Use Japa with Adonis plugins. Put focused unit tests under `tests/unit`, HTTP/database flows under `tests/functional`, and browser flows under `tests/browser`. Name specs with `.spec.ts`. Run `pnpm test` for the full suite and `pnpm typecheck` before opening a PR.

## Commit & Pull Request Guidelines

History uses concise Conventional Commit subjects, now often with gitmoji: `🔧 chore: ...`, `🔒 security: ...`, `feat: ...`, `fix: ...`, `refactor: ...`. Keep commits scoped and explain why, not every implementation detail.

PRs should include a short summary, linked issue or spec when applicable, validation commands run, migration notes, and screenshots for Inertia UI changes.

## Security & Configuration Tips

Never commit `.env` or secrets. Use `.env.example` for required keys. Local data services are defined in `docker-compose.yml`; PostgreSQL is TimescaleDB HA PG17 and Redis is used for sessions and queue-related work. Keep PII paths out of logs and preserve logger redaction.
