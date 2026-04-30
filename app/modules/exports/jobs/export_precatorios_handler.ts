export const EXPORT_PRECATORIOS_QUEUE = 'exports-precatorios'

export type ExportPrecatoriosPayload = {
  tenantId: string
  exportJobId: string
}

export async function handleExportPrecatorios(_payload: ExportPrecatoriosPayload) {
  // Export processing is implemented after filters and storage paths are finalized.
}
