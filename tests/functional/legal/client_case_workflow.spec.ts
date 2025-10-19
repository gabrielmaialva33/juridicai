import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { UserFactory } from '#database/factories/user_factory'
import { TenantFactory } from '#database/factories/tenant_factory'
import { TenantUserFactory } from '#database/factories/tenant_user_factory'
import { ClientFactory } from '#database/factories/client_factory'
import { CaseFactory } from '#database/factories/case_factory'
import { DeadlineFactory } from '#database/factories/deadline_factory'
import { DocumentFactory } from '#database/factories/document_factory'
import { CaseEventFactory } from '#database/factories/case_event_factory'
import TenantContextService from '#services/tenants/tenant_context_service'
import { DateTime } from 'luxon'
import Case from '#models/case'

test.group('Client-Case Workflow', (group) => {
  group.each.setup(async () => {
    await testUtils.db().truncate()
  })

  test('complete legal workflow: client creation to case closure', async ({ assert }) => {
    // Setup: Create law firm (tenant) with lawyers
    const tenant = await TenantFactory.merge({
      name: 'Silva & Associados',
      subdomain: 'silva-adv',
      plan: 'pro',
    }).create()

    const lawyer = await UserFactory.merge({
      full_name: 'Dr. João Silva',
      email: 'joao@silva-adv.com.br',
    }).create()

    await TenantUserFactory.apply('lawyer')
      .merge({
        tenant_id: tenant.id,
        user_id: lawyer.id,
      })
      .create()

    // Step 1: Create new client
    const client = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: lawyer.id, tenant_user: null },
      async () => {
        return await ClientFactory.apply('withVisibleId')
          .merge({
            full_name: 'Maria Santos',
            cpf: '123.456.789-00',
            phone: '(11) 98765-4321',
            email: 'maria.santos@email.com',
            is_active: true,
          })
          .create()
      }
    )

    assert.equal(client.full_name, 'Maria Santos')
    assert.equal(client.tenant_id, tenant.id)

    // Step 2: Create case for client
    const caseModel = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: lawyer.id, tenant_user: null },
      async () => {
        return await CaseFactory.merge({
          client_id: client.id,
          responsible_lawyer_id: lawyer.id,
          case_type: 'labor',
          status: 'active',
          priority: 'high',
          case_value: 50000,
        }).create()
      }
    )

    assert.equal(caseModel.client_id, client.id)
    assert.equal(caseModel.responsible_lawyer_id, lawyer.id)

    // Step 3: Create deadlines for case
    const deadline1 = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: lawyer.id, tenant_user: null },
      async () => {
        return await DeadlineFactory.merge({
          case_id: caseModel.id,
          responsible_id: lawyer.id,
          title: 'Prazo para Contestação',
          deadline_date: DateTime.now().plus({ days: 15 }),
          is_fatal: true,
          status: 'pending',
        }).create()
      }
    )

    const deadline2 = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: lawyer.id, tenant_user: null },
      async () => {
        return await DeadlineFactory.merge({
          case_id: caseModel.id,
          responsible_id: lawyer.id,
          title: 'Audiência de Conciliação',
          deadline_date: DateTime.now().plus({ days: 30 }),
          is_fatal: false,
          status: 'pending',
        }).create()
      }
    )

    assert.isTrue(deadline1.is_fatal)
    assert.isFalse(deadline2.is_fatal)

    // Step 4: Upload documents to case
    const document1 = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: lawyer.id, tenant_user: null },
      async () => {
        return await DocumentFactory.merge({
          case_id: caseModel.id,
          client_id: client.id,
          uploaded_by: lawyer.id,
          document_type: 'petition',
          title: 'Petição Inicial',
          is_signed: true,
        }).create()
      }
    )

    const document2 = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: lawyer.id, tenant_user: null },
      async () => {
        return await DocumentFactory.merge({
          case_id: caseModel.id,
          client_id: client.id,
          uploaded_by: lawyer.id,
          document_type: 'evidence',
          title: 'Contrato de Trabalho',
        }).create()
      }
    )

    assert.equal(document1.document_type, 'petition')
    assert.equal(document2.document_type, 'evidence')

    // Step 5: Create case events (timeline)
    const event1 = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: lawyer.id, tenant_user: null },
      async () => {
        return await CaseEventFactory.merge({
          case_id: caseModel.id,
          created_by: lawyer.id,
          event_type: 'filing',
          title: 'Processo Distribuído',
          source: 'court_api',
          event_date: DateTime.now(),
        }).create()
      }
    )

    const event2 = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: lawyer.id, tenant_user: null },
      async () => {
        return await CaseEventFactory.merge({
          case_id: caseModel.id,
          created_by: lawyer.id,
          event_type: 'hearing',
          title: 'Audiência Agendada',
          source: 'manual',
          event_date: DateTime.now().plus({ days: 30 }),
        }).create()
      }
    )

    assert.equal(event1.event_type, 'filing')
    assert.equal(event2.event_type, 'hearing')

    // Step 6: Load case with all relationships
    const loadedCase = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: lawyer.id, tenant_user: null },
      async () => {
        const caseWithRelations = await Case.query()
          .where('id', caseModel.id)
          .preload('client')
          .preload('deadlines')
          .preload('documents')
          .preload('events')
          .firstOrFail()

        // Load responsible_lawyer separately to avoid context issues
        await caseWithRelations.load('responsible_lawyer')

        return caseWithRelations
      }
    )

    assert.equal(loadedCase.client.full_name, 'Maria Santos')
    assert.equal(loadedCase.responsible_lawyer.full_name, 'Dr. João Silva')
    assert.equal(loadedCase.deadlines.length, 2)
    assert.equal(loadedCase.documents.length, 2)
    assert.equal(loadedCase.events.length, 2)

    // Step 7: Mark deadline as completed
    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: lawyer.id, tenant_user: null },
      async () => {
        deadline1.status = 'completed'
        deadline1.completed_at = DateTime.now()
        deadline1.completed_by = lawyer.id
        deadline1.completion_notes = 'Contestação protocolada com sucesso'
        await deadline1.save()

        await deadline1.refresh()
        assert.equal(deadline1.status, 'completed')
        assert.isNotNull(deadline1.completed_at)
      }
    )

    // Step 8: Close case
    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: lawyer.id, tenant_user: null },
      async () => {
        caseModel.status = 'closed'
        caseModel.closed_at = DateTime.now()
        await caseModel.save()

        await caseModel.refresh()
        assert.equal(caseModel.status, 'closed')
        assert.isNotNull(caseModel.closed_at)
      }
    )
  })

  test('case can have multiple clients (joint representation)', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const lawyer = await UserFactory.create()

    await TenantUserFactory.apply('lawyer')
      .merge({
        tenant_id: tenant.id,
        user_id: lawyer.id,
      })
      .create()

    // Create main client
    const mainClient = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: lawyer.id, tenant_user: null },
      async () => {
        return await ClientFactory.apply('withVisibleId')
          .merge({ full_name: 'Main Client' })
          .create()
      }
    )

    // Create additional clients
    const client2 = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: lawyer.id, tenant_user: null },
      async () => {
        return await ClientFactory.apply('withVisibleId').merge({ full_name: 'Client 2' }).create()
      }
    )

    // Create case with main client
    const caseModel = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: lawyer.id, tenant_user: null },
      async () => {
        return await CaseFactory.merge({
          client_id: mainClient.id,
          responsible_lawyer_id: lawyer.id,
        }).create()
      }
    )

    // Both clients can have documents in the same case
    await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: lawyer.id, tenant_user: null },
      async () => {
        await DocumentFactory.merge({
          case_id: caseModel.id,
          client_id: mainClient.id,
          uploaded_by: lawyer.id,
        }).create()

        await DocumentFactory.merge({
          case_id: caseModel.id,
          client_id: client2.id,
          uploaded_by: lawyer.id,
        }).create()
      }
    )

    // Load case documents
    const loadedCase = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: lawyer.id, tenant_user: null },
      async () => {
        return await Case.query().where('id', caseModel.id).preload('documents').firstOrFail()
      }
    )

    assert.equal(loadedCase.documents.length, 2)
  })

  test('deadline alerts configuration', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const lawyer = await UserFactory.create()

    await TenantUserFactory.apply('lawyer')
      .merge({
        tenant_id: tenant.id,
        user_id: lawyer.id,
      })
      .create()

    const deadline = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: lawyer.id, tenant_user: null },
      async () => {
        const client = await ClientFactory.apply('withVisibleId').create()
        const caseModel = await CaseFactory.merge({
          client_id: client.id,
          responsible_lawyer_id: lawyer.id,
        }).create()

        return await DeadlineFactory.merge({
          case_id: caseModel.id,
          responsible_id: lawyer.id,
          is_fatal: true,
          alert_config: {
            days_before: [15, 10, 7, 3, 1],
            email_enabled: true,
            sms_enabled: true,
            push_enabled: true,
            recipients: [lawyer.id],
          },
        }).create()
      }
    )

    assert.isTrue(deadline.alert_config?.email_enabled)
    assert.isTrue(deadline.alert_config?.sms_enabled)
    assert.equal(deadline.alert_config?.days_before?.length, 5)
    assert.deepEqual(deadline.alert_config?.recipients, [lawyer.id])
  })

  test('document versioning', async ({ assert }) => {
    const tenant = await TenantFactory.create()
    const lawyer = await UserFactory.create()

    await TenantUserFactory.apply('lawyer')
      .merge({
        tenant_id: tenant.id,
        user_id: lawyer.id,
      })
      .create()

    const { document1, document2 } = await TenantContextService.run(
      { tenant_id: tenant.id, tenant, user_id: lawyer.id, tenant_user: null },
      async () => {
        const client = await ClientFactory.apply('withVisibleId').create()
        const caseModel = await CaseFactory.merge({
          client_id: client.id,
          responsible_lawyer_id: lawyer.id,
        }).create()

        // Upload first version
        const doc1 = await DocumentFactory.merge({
          case_id: caseModel.id,
          client_id: client.id,
          uploaded_by: lawyer.id,
          title: 'Contrato',
          version: 1,
        }).create()

        // Upload second version
        const doc2 = await DocumentFactory.merge({
          case_id: caseModel.id,
          client_id: client.id,
          uploaded_by: lawyer.id,
          title: 'Contrato',
          version: 2,
          parent_document_id: doc1.id,
        }).create()

        return { document1: doc1, document2: doc2 }
      }
    )

    assert.equal(document1.version, 1)
    assert.equal(document2.version, 2)
    assert.equal(document2.parent_document_id, document1.id)
  })
})
