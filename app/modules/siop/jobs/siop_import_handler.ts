export const SIOP_IMPORT_QUEUE = 'siop:imports'

export type SiopImportJobPayload = {
  tenantId: string
  importId: string
}

export async function handleSiopImport(_payload: SiopImportJobPayload) {
  // Import processing is implemented after the module boundary is stable.
}
