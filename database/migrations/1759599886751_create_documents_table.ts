import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'documents'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()

      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table
        .bigInteger('case_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('cases')
        .onDelete('CASCADE')
      table
        .bigInteger('client_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('clients')
        .onDelete('SET NULL')
      table
        .bigInteger('uploaded_by')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')

      table.string('title', 255).notNullable()
      table.text('description').nullable()

      // Tipo de documento
      table
        .enum('document_type', [
          'petition',
          'contract',
          'evidence',
          'judgment',
          'appeal',
          'power_of_attorney',
          'agreement',
          'report',
          'other',
        ])
        .notNullable()
        .defaultTo('other')

      // Armazenamento
      table.string('file_path', 500).notNullable().comment('Caminho no storage')
      table.string('file_hash', 64).nullable().comment('SHA256 hash para deduplicação')
      table.bigInteger('file_size').notNullable().comment('Tamanho em bytes')
      table.string('mime_type', 100).notNullable()
      table.string('original_filename', 255).notNullable()

      // Storage provider
      table
        .enum('storage_provider', ['local', 's3', 'gcs'])
        .notNullable()
        .defaultTo('local')

      // OCR e conteúdo
      table.text('ocr_text').nullable().comment('Texto extraído por OCR')
      table.boolean('is_ocr_processed').notNullable().defaultTo(false)

      // Assinatura digital
      table.boolean('is_signed').notNullable().defaultTo(false)
      table.jsonb('signature_data').nullable()

      // Controle de acesso
      table
        .enum('access_level', ['tenant', 'case_team', 'owner_only'])
        .notNullable()
        .defaultTo('tenant')

      // Organização
      table.specificType('tags', 'text[]').nullable()
      table.integer('version').notNullable().defaultTo(1)
      table.bigInteger('parent_document_id').unsigned().nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    // Indexes
    this.schema.raw('CREATE INDEX idx_documents_tenant_id ON documents(tenant_id)')
    this.schema.raw('CREATE INDEX idx_documents_case_id ON documents(tenant_id, case_id)')
    this.schema.raw('CREATE INDEX idx_documents_client_id ON documents(tenant_id, client_id)')
    this.schema.raw('CREATE INDEX idx_documents_type ON documents(tenant_id, document_type)')
    this.schema.raw('CREATE INDEX idx_documents_uploaded_by ON documents(tenant_id, uploaded_by)')
    this.schema.raw('CREATE INDEX idx_documents_file_hash ON documents(file_hash)')

    // Full-text search on OCR text
    this.schema.raw(`
      CREATE INDEX idx_documents_ocr_search
      ON documents
      USING GIN(to_tsvector('portuguese', COALESCE(ocr_text, '')))
    `)

    // Title and description search
    this.schema.raw(`
      CREATE INDEX idx_documents_title_search
      ON documents
      USING GIN(to_tsvector('portuguese',
        COALESCE(title, '') || ' ' || COALESCE(description, '')
      ))
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
