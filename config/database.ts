import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

const dbConfig = defineConfig({
  connection: 'postgres',

  connections: {
    /**
     * PostgreSQL connection.
     *
     * Dev runs on TimescaleDB HA PostgreSQL 17 so we can enable hypertables in
     * later migrations without changing the application connection config.
     */
    postgres: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD'),
        database: env.get('DB_DATABASE'),
      },
      pool: {
        /**
         * Expose the PII encryption key as a PostgreSQL setting for SECURITY
         * DEFINER functions that decrypt bunker data.
         */
        afterCreate: (conn: any, done: any) => {
          conn.query(
            `select set_config('app.pii_encryption_key', $1, false)`,
            [env.get('PII_ENCRYPTION_KEY')],
            done
          )
        },
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      seeders: {
        paths: ['database/seeders'],
      },
    },
  },
})

export default dbConfig
