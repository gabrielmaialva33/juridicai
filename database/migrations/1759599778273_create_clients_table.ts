import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'clients'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()

      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')

      table
        .enum('client_type', ['individual', 'company'])
        .notNullable()
        .comment('Tipo: pessoa física ou jurídica')

      // Dados de pessoa física
      table.string('full_name', 255).nullable().comment('Nome completo (pessoa física)')
      table.string('cpf', 14).nullable().comment('CPF (pessoa física)')

      // Dados de empresa
      table.string('company_name', 255).nullable().comment('Razão social (pessoa jurídica)')
      table.string('cnpj', 18).nullable().comment('CNPJ (pessoa jurídica)')

      // Dados comuns
      table.string('email', 255).nullable()
      table.string('phone', 20).nullable()
      table.jsonb('address').nullable().comment('Endereço completo')
      table.specificType('tags', 'text[]').nullable().comment('Tags para categorização')
      table.boolean('is_active').notNullable().defaultTo(true)
      table.jsonb('custom_fields').nullable().comment('Campos customizados extensíveis')
      table.text('notes').nullable().comment('Observações internas')

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      // Constraints
      table.unique(['tenant_id', 'cpf'])
      table.unique(['tenant_id', 'cnpj'])
    })

    // Indexes
    this.schema.raw('CREATE INDEX idx_clients_tenant_id ON clients(tenant_id)')
    this.schema.raw('CREATE INDEX idx_clients_client_type ON clients(tenant_id, client_type)')
    this.schema.raw('CREATE INDEX idx_clients_is_active ON clients(tenant_id, is_active)')
    this.schema.raw('CREATE INDEX idx_clients_email ON clients(tenant_id, email)')
    this.schema.raw('CREATE INDEX idx_clients_cpf ON clients(tenant_id, cpf)')
    this.schema.raw('CREATE INDEX idx_clients_cnpj ON clients(tenant_id, cnpj)')

    // Full-text search (nome e razão social)
    this.schema.raw(`
      CREATE INDEX idx_clients_search
        ON clients
          USING GIN (to_tsvector('portuguese', COALESCE(full_name, '') || ' ' || COALESCE(company_name, '')))
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
