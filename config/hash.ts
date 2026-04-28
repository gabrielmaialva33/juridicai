import { defineConfig, drivers } from '@adonisjs/core/hash'

/**
 * Hashing configuration.
 *
 * Argon2id is the default password hasher for new credentials. Keep the
 * legacy scrypt driver configured while this project is still carrying starter
 * code or until every existing password hash has been rehashed.
 */
const hashConfig = defineConfig({
  default: 'argon',

  list: {
    /**
     * Argon2 password hashing.
     *
     * Adonis stores hashes in PHC format, so the algorithm parameters are kept
     * with each hash and can be checked later with needsReHash().
     */
    argon: drivers.argon2({
      version: 0x13,
      variant: 'id',
      iterations: 3,
      memory: 65536,
      parallelism: 4,
      saltSize: 16,
      hashLength: 32,
    }),

    /**
     * Legacy scrypt support.
     *
     * Keep this driver available so old starter-generated hashes can still be
     * verified during the migration window.
     */
    scrypt: drivers.scrypt({
      cost: 16384,
      blockSize: 8,
      parallelization: 1,
      saltSize: 16,
      maxMemory: 33554432,
      keyLength: 64,
    }),
  },
})

export default hashConfig

declare module '@adonisjs/core/types' {
  export interface HashersList extends InferHashers<typeof hashConfig> {}
}
