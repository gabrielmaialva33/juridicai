# Government Precatorios Data Sources

Research date: 2026-04-30

## Source Map

### Federal

The canonical public ingestion source is **SIOP Precatórios Dados Abertos**, published by SOF/MPO. It exposes federal precatorios and RPVs as open data, including historical budget data from 2007 and yearly expedition files from 2008 onward. This should remain the primary federal backfill path.

SIOP also exposes **WSPrecatorios**, a SOAP XML web service used by courts to include/delete annual precatorio information. It requires credential payloads and client certificate configuration, and the official manual says the service only works during SOF-defined reporting windows. Treat it as a credentialed institutional integration, not the public ingestion path.

### Cross-Court Enrichment

The **CNJ DataJud Public API** is the correct enrichment layer for process metadata. It is organized by court alias, not as one universal endpoint. It covers federal regional courts, state courts, labor courts, superior courts, and electoral courts. Use it to enrich `precatorio_assets` with lawsuit metadata and movements after discovery.

### State And Municipal

State and municipal precatorio discovery is court-centered. CNJ materials state that all issuing courts send data for the **Mapa Anual dos Precatórios**, and those maps reflect debts owed by states, municipalities, the Union, autarchies, and foundations. Municipal debts may appear in TJ, TRF, or TRT publications depending on where the requisition was issued.

Until SisPreq exposes a stable public API, the practical route is a provider catalog plus per-court adapters for transparency pages, annual maps, XLS/XLSX/PDF downloads, and dashboard embeds.

## Architecture Direction

- `siop-open-data-precatorios`: primary federal ingestion.
- `datajud-public-api`: process enrichment for federal, state, and municipal levels.
- `cnj-annual-precatorios-map`: aggregate cross-check and coverage monitor.
- `cjf-trf-precatorios-pages`: federal payment-status enrichment and reconciliation.
- `court-annual-map-pages`: primary state/municipal discovery lane with per-court adapters.

Store every fetched file or payload as `source_records` before normalization. Provider adapters should emit a common staging contract and record source URL, checksum, collection time, acquisition mode, court alias, federative level, and raw metadata.

## Official References

- SIOP open data: https://www.gov.br/planejamento/pt-br/assuntos/orcamento/precatorios-content/painel-precatorios/dados-abertos
- SIOP WS catalog: https://www.gov.br/conecta/catalogo/apis/precatorios-do-siop
- SIOP WS manual: https://www1.siop.planejamento.gov.br/siopdoc/doku.php/webservices:manual-wsprecatorios
- CNJ DataJud public API: https://www.cnj.jus.br/sistemas/datajud/api-publica/
- DataJud endpoints: https://datajud-wiki.cnj.jus.br/api-publica/endpoints/
- CNJ Sistema de Gestão de Precatórios: https://www.cnj.jus.br/sistema-de-gestao-de-precatorios/
- CJF/TRF precatorios and RPVs: https://www.cjf.jus.br/publico/rpvs_precatorios/
