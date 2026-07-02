import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('monitored_bar_registrations', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table.text('bar_number').notNullable()
      table.text('state_code').notNullable()
      table.text('lawyer_name').nullable()
      table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      table.boolean('active').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['tenant_id', 'bar_number', 'state_code'])
      table.unique(['tenant_id', 'id'])
      table.index(['tenant_id', 'active'])
    })

    this.schema.createTable('monitored_cases', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table.uuid('judicial_process_id').nullable()
      table.uuid('monitored_bar_registration_id').nullable()
      table.text('cnj_number').notNullable()
      table.text('label').nullable()
      table.text('client_party_side').nullable().checkIn(['plaintiff', 'defendant'])
      table.boolean('active').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['tenant_id', 'cnj_number'])
      table.unique(['tenant_id', 'id'])
      table.index(['tenant_id', 'judicial_process_id'])
      table.index(['tenant_id', 'active'])
    })

    this.schema.createTable('court_holidays', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.text('scope').notNullable().checkIn(['national', 'court'])
      table.text('court_alias').nullable()
      table.date('date').notNullable()
      table.text('description').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['scope', 'court_alias', 'date'])
    })

    this.schema.createTable('legal_publications', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table.uuid('judicial_process_id').nullable()
      table.uuid('precatorio_asset_id').nullable()
      table.uuid('monitored_case_id').nullable()
      table.uuid('monitored_bar_registration_id').nullable()

      table.text('djen_id').notNullable()
      table.text('process_number').notNullable()
      table.text('court_alias').nullable()
      table.text('communication_type').nullable()
      table.text('court_body').nullable()
      table.text('judicial_class').nullable()
      table.text('link').nullable()
      table.text('matched_bar_registration').nullable()
      table.text('origin').notNullable().checkIn(['monitored_case', 'bar_registration'])
      table.text('body').notNullable()
      table.text('text_hash').nullable()
      table.jsonb('raw_data').nullable()
      table.date('available_at').nullable()
      table.date('published_at').nullable()

      table.text('determination').nullable()
      table.text('branch').nullable()
      table.text('act_type').nullable()
      table.text('recommended_action').nullable()
      table.text('legal_basis').nullable()
      table.integer('deadline_days').nullable()
      table.text('deadline_kind').nullable().checkIn(['business_days', 'calendar_days'])
      table.jsonb('deadline_items').nullable()
      table.jsonb('labels').nullable()
      table.date('hearing_at').nullable()
      table.string('hearing_time', 5).nullable()
      table.date('judgment_at').nullable()
      table.text('priority').nullable()
      table.text('confidence').nullable()
      table.text('notes').nullable()

      table.date('due_at').nullable()
      table.boolean('overdue').notNullable().defaultTo(false)
      table.integer('business_days_until_hearing').nullable()
      table.boolean('hearing_elapsed').notNullable().defaultTo(false)
      table.boolean('partial_calendar').notNullable().defaultTo(false)
      table.boolean('manual_review_required').notNullable().defaultTo(false)
      table.text('deadline_reason').nullable()

      table.boolean('validator_failed').notNullable().defaultTo(false)
      table.text('validator_reason').nullable()

      table.text('status').notNullable().checkIn(['new', 'confirmed', 'dismissed']).defaultTo('new')
      table.date('manual_due_at').nullable()
      table
        .uuid('confirmed_by_user_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('confirmed_at', { useTz: true }).nullable()

      table.timestamp('processed_at', { useTz: true }).nullable()
      table.timestamp('interpretation_requested_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['tenant_id', 'djen_id'])
      table.unique(['tenant_id', 'id'])
      table.index(['tenant_id', 'judicial_process_id'])
      table.index(['tenant_id', 'precatorio_asset_id'])
      table.index(['tenant_id', 'status'])
      table.index(['tenant_id', 'due_at'])
    })

    this.schema.createTable('legal_publication_events', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table.uuid('legal_publication_id').notNullable()
      table
        .text('event_type')
        .notNullable()
        .checkIn([
          'ingested',
          'interpreted',
          'deadline_calculated',
          'confirmed',
          'dismissed',
          'deadline_edited',
          'interpretation_requested',
          'interpretation_edited',
          'projected_to_asset',
        ])
      table.jsonb('payload').nullable()
      table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(['tenant_id', 'legal_publication_id'])
      table.index(['tenant_id', 'event_type'])
    })

    this.defer((db) =>
      db.rawQuery(`
        alter table monitored_cases
        add constraint monitored_cases_process_same_tenant_fk
        foreign key (tenant_id, judicial_process_id)
        references judicial_processes (tenant_id, id)
        on delete set null (judicial_process_id);

        alter table monitored_cases
        add constraint monitored_cases_bar_registration_same_tenant_fk
        foreign key (tenant_id, monitored_bar_registration_id)
        references monitored_bar_registrations (tenant_id, id)
        on delete set null (monitored_bar_registration_id);

        alter table legal_publications
        add constraint legal_publications_process_same_tenant_fk
        foreign key (tenant_id, judicial_process_id)
        references judicial_processes (tenant_id, id)
        on delete set null (judicial_process_id);

        alter table legal_publications
        add constraint legal_publications_asset_same_tenant_fk
        foreign key (tenant_id, precatorio_asset_id)
        references precatorio_assets (tenant_id, id)
        on delete set null (precatorio_asset_id);

        alter table legal_publications
        add constraint legal_publications_monitored_case_same_tenant_fk
        foreign key (tenant_id, monitored_case_id)
        references monitored_cases (tenant_id, id)
        on delete set null (monitored_case_id);

        alter table legal_publications
        add constraint legal_publications_bar_registration_same_tenant_fk
        foreign key (tenant_id, monitored_bar_registration_id)
        references monitored_bar_registrations (tenant_id, id)
        on delete set null (monitored_bar_registration_id);

        alter table legal_publication_events
        add constraint legal_publication_events_publication_same_tenant_fk
        foreign key (tenant_id, legal_publication_id)
        references legal_publications (tenant_id, id)
        on delete cascade;
      `)
    )
  }

  async down() {
    this.schema.dropTable('legal_publication_events')
    this.schema.dropTable('legal_publications')
    this.schema.dropTable('court_holidays')
    this.schema.dropTable('monitored_cases')
    this.schema.dropTable('monitored_bar_registrations')
  }
}
