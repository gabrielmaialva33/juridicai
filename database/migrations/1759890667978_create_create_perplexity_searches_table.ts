import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'perplexity_searches'

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
      table.text('query').notNullable().comment('User query sent to Perplexity')
      table.text('response').notNullable().comment('AI-generated response')

      // Search configuration
      table
        .enum('search_type', [
          'legal_research',
          'legislation',
          'case_analysis',
          'legal_writing',
          'general',
        ])
        .notNullable()
        .comment('Type of legal search performed')

      table.string('model', 100).notNullable().comment('Perplexity model used (e.g., sonar-pro)')
      table.string('search_mode', 50).nullable().comment('web or academic mode')

      // Usage metrics
      table.integer('tokens_used').nullable().comment('Total tokens consumed')
      table.integer('prompt_tokens').nullable().comment('Tokens in prompt')
      table.integer('completion_tokens').nullable().comment('Tokens in completion')

      // Search metadata (JSONB for flexibility)
      table
        .jsonb('metadata')
        .nullable()
        .comment(
          'Additional search metadata: sources, related_questions, domain_filter, recency_filter'
        )

      // Search results from Perplexity
      table.jsonb('search_results').nullable().comment('Array of web sources with titles and URLs')

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
    this.schema.raw('CREATE INDEX idx_perplexity_searches_tenant_id ON perplexity_searches(tenant_id)')
    this.schema.raw(
      'CREATE INDEX idx_perplexity_searches_user_id ON perplexity_searches(tenant_id, user_id)'
    )
    this.schema.raw(
      'CREATE INDEX idx_perplexity_searches_search_type ON perplexity_searches(tenant_id, search_type)'
    )
    this.schema.raw(
      'CREATE INDEX idx_perplexity_searches_case_id ON perplexity_searches(tenant_id, case_id)'
    )
    this.schema.raw(
      'CREATE INDEX idx_perplexity_searches_created_at ON perplexity_searches(tenant_id, created_at DESC)'
    )

    // Full-text search on queries
    this.schema.raw(`
      CREATE INDEX idx_perplexity_searches_query_search
        ON perplexity_searches
          USING GIN (to_tsvector('portuguese', query))
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}