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

## Field Coverage Findings

### DataJud Public API

DataJud is the national process-metadata layer. A real TJSP query for classes `1265`
and `1266` returned `hits.total.relation = gte` with `value = 10000`, confirming that
the source is broad enough for national discovery but must be paginated per court alias.

Normalize these fields:

- Process cover: `numeroProcesso`, `tribunal`, `grau`, `nivelSigilo`, `dataAjuizamento`,
  `dataHoraUltimaAtualizacao`, `@timestamp`.
- Classification: `classe.codigo`, `classe.nome`, `assuntos.codigo`, `assuntos.nome`.
- Origin system: `sistema.codigo`, `sistema.nome`, `formato.codigo`, `formato.nome`.
- Judging body: `orgaoJulgador.codigo`, `orgaoJulgador.nome`,
  `orgaoJulgador.codigoMunicipioIBGE`.
- Timeline: `movimentos.codigo`, `movimentos.nome`, `movimentos.dataHora`,
  `movimentos.orgaoJulgador`.
- Movement complements: `movimentos.complementosTabelados.codigo`,
  `descricao`, `valor`, `nome`.

The normalized tables should be:

- `judicial_processes`: process cover and current court/body metadata.
- `judicial_process_subjects`: one row per TPU subject.
- `judicial_process_movements`: one row per timeline movement.
- `judicial_process_movement_complements`: one row per movement complement.
- `judicial_process_signals`: one row per classified legal signal, preserving evidence.

This shape makes it possible to classify legal signals from real movement data, for
example `Expedição de precatório/rpv`, `Remessa`, `Publicação`, `Conclusão`,
document type, petition type, and remittance reason.

Legal signals should be derived deterministically before any AI step. The first
classifier maps normalized movements and complements into operational event codes
already consumed by pricing: `requisition_issued`, `payment_available`,
`final_judgment`, `calculation_homologated`, `superpreference_granted`,
`direct_agreement_opened`, `prior_cession_detected`, `lien_detected`,
`suspension_detected`, `objection_pending`, `beneficiary_inventory_pending`,
`fee_dispute_detected`, and `special_regime_declared`. When a process is linked
to a financial asset, the signal is also projected into `asset_events` and triggers
a `legal-signals-v1` score snapshot. The score snapshot uses a fingerprint of the
current signal events, so retries do not create duplicate equivalent scores.

### SIOP Open Data

The official SIOP landing page exposes CSV links for:

- Budget execution history from 2007 onward.
- Monetary correction index used to update historical values.
- Annual expedition files from `expedidos_2008.csv` through `expedidos_2027.csv`.

SIOP remains the best federal financial source for face value, debtor/budget context,
annual expedition, and correction inputs. It does not replace DataJud movements.

### CJF/TRF Public Pages

The CJF public page links users to TRF1 through TRF6 portals and embeds an official
PowerBI panel. This layer is best treated as federal payment-status enrichment:
bank availability, TRF-specific consultation, chronological order, and reconciliation
against SIOP assets.

### State And Municipal Strategy

There is no single reliable public endpoint for every state and municipality. The
correct strategy is a provider catalog plus adapters per court/publication format:
DataJud for process discovery and movement metadata, then TJ/TRT/TRF transparency
files or pages for queue/payment/face-value details.

## Job Orchestration Direction

Use one high-level tenant job for the daily public-data cycle:

1. Discover and download SIOP open data for the target years.
2. Enqueue SIOP import jobs for downloaded annual files.
3. Scan DataJud nationally by court alias for classes `1265` and `1266`.
4. Enrich known assets by inferred court alias.
5. Classify legal signals from normalized DataJud movements.
6. Refresh linked asset scores from projected legal signals.
7. Persist DataJud match candidates for review.
8. Refresh derived aggregates after import workers finish.

Keep individual jobs available for retry, but schedule the orchestrator as the canonical
entry point. This gives operators one audit trail for the government data cycle and keeps
phase metrics comparable over time.

## Official References

- SIOP open data: https://www.gov.br/planejamento/pt-br/assuntos/orcamento/precatorios-content/painel-precatorios/dados-abertos
- SIOP WS catalog: https://www.gov.br/conecta/catalogo/apis/precatorios-do-siop
- SIOP WS manual: https://www1.siop.planejamento.gov.br/siopdoc/doku.php/webservices:manual-wsprecatorios
- CNJ DataJud public API: https://www.cnj.jus.br/sistemas/datajud/api-publica/
- DataJud endpoints: https://datajud-wiki.cnj.jus.br/api-publica/endpoints/
- CNJ Sistema de Gestão de Precatórios: https://www.cnj.jus.br/sistema-de-gestao-de-precatorios/
- CJF/TRF precatorios and RPVs: https://www.cjf.jus.br/publico/rpvs_precatorios/
