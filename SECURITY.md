# Security Policy

## Supported Versions

This project is in pre-release development. Security fixes target the `main` branch unless a maintained release branch is explicitly announced.

## Reporting a Vulnerability

Do not open a public issue for vulnerabilities, exposed credentials, PII leakage, authentication bypasses, tenant isolation issues, queue/job abuse, or ingestion paths that can corrupt source evidence.

Report privately to the maintainers with:

- A clear summary of the issue.
- Steps to reproduce or a proof of concept.
- Affected routes, commands, jobs, or data sources.
- Potential impact and whether sensitive data may be involved.
- Suggested remediation, if known.

## Handling Expectations

Maintainers will acknowledge valid reports as soon as practical, investigate privately, and coordinate a fix before public disclosure. Reports involving PII, credentials, or tenant isolation receive priority.

## Security Scope

High-priority areas include:

- Authentication and session handling.
- Tenant isolation and authorization.
- PII reveal flows and audit logs.
- Public API ingestion, file downloads, CSV/XLS/PDF parsing, and source evidence integrity.
- Queue workers, scheduled jobs, and retry/admin controls.
- Secrets, environment variables, and logging redaction.

## Local Development

- Never commit `.env`, API keys, database dumps, or raw production data.
- Use `.env.example` for required variables only.
- Keep test fixtures synthetic or publicly sourced.
- Redact PII and credentials before sharing logs.
