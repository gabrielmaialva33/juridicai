import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'nvidia_queries'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()

      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table
        .bigInteger('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      // Query and response data
      table.text('query').notNullable().comment('User query sent to NVIDIA')
      table.text('response').notNullable().comment('AI-generated response')

      // Query configuration
      table
        .enum('query_type', [
          'document_analysis',
          'contract_review',
          'code_generation',
          'text_analysis',
          'general',
        ])
        .notNullable()
        .comment('Type of query performed')

      table.string('model', 100).notNullable().comment('NVIDIA model used')
      table.decimal('temperature', 3, 2).nullable().comment('Temperature parameter used')
      table.decimal('top_p', 3, 2).nullable().comment('Top P parameter used')

      // Usage metrics
      table.integer('tokens_used').nullable().comment('Total tokens consumed')
      table.integer('prompt_tokens').nullable().comment('Tokens in prompt')
      table.integer('completion_tokens').nullable().comment('Tokens in completion')

      // Query metadata (JSONB for flexibility)
      table
        .jsonb('metadata')
        .nullable()
        .comment('Additional query metadata: analysis_type, review_focus, template_type, etc.')

      // Optional case association
      table
        .bigInteger('case_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('cases')
        .onDelete('SET NULL')

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    // Indexes for performance
    this.schema.raw('CREATE INDEX idx_nvidia_queries_tenant_id ON nvidia_queries(tenant_id)')
    this.schema.raw('CREATE INDEX idx_nvidia_queries_user_id ON nvidia_queries(tenant_id, user_id)')
    this.schema.raw(
      'CREATE INDEX idx_nvidia_queries_query_type ON nvidia_queries(tenant_id, query_type)'
    )
    this.schema.raw('CREATE INDEX idx_nvidia_queries_case_id ON nvidia_queries(tenant_id, case_id)')
    this.schema.raw(
      'CREATE INDEX idx_nvidia_queries_created_at ON nvidia_queries(tenant_id, created_at DESC)'
    )

    // Full-text search on queries
    this.schema.raw(`
      CREATE INDEX idx_nvidia_queries_query_search
        ON nvidia_queries
          USING GIN (to_tsvector('portuguese', query))
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
