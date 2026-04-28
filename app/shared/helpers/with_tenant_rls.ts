import db from '@adonisjs/lucid/services/db'

/**
 * Runs a callback inside a transaction with PostgreSQL tenant settings applied.
 */
export async function withTenantRls<T>(tenantId: string, callback: () => Promise<T>): Promise<T> {
  return db.transaction(async (trx) => {
    await trx.rawQuery(`select set_config('app.tenant_id', ?, true)`, [tenantId])
    return callback()
  })
}
