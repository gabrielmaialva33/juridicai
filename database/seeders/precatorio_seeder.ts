import { BaseSeeder } from '@adonisjs/lucid/seeders'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import TenantContextService from '#services/tenants/tenant_context_service'
import { TenantFactory } from '#database/factories/tenant_factory'
import { UserFactory } from '#database/factories/user_factory'
import { TenantUserFactory } from '#database/factories/tenant_user_factory'
import { ClientFactory } from '#database/factories/client_factory'
import { PrecatorioCaseFactory } from '#database/factories/precatorio_case_factory'
import { DeadlineFactory } from '#database/factories/deadline_factory'
import { DocumentFactory } from '#database/factories/document_factory'
import { CaseEventFactory } from '#database/factories/case_event_factory'
import { TimeEntryFactory } from '#database/factories/time_entry_factory'
import { PerplexitySearchFactory } from '#database/factories/perplexity_search_factory'
import { NvidiaQueryFactory } from '#database/factories/nvidia_query_factory'
import {
  ESCRITORIOS_FAMOSOS,
  TIPOS_PRECATORIO,
  EVENTOS_PRECATORIO,
  DOCUMENTOS_PRECATORIO,
} from '#database/seeders/helpers/precatorio_data'

/**
 * Seeder de Processos de Precatórios Brasileiros
 *
 * Cria 3-5 escritórios especializados em precatórios com dados realistas:
 * - Escritórios baseados em firmas reais (Corino, Sandoval Filho, etc.)
 * - 5-10 processos de precatórios por escritório
 * - Todos os tipos: Federal, Estadual, Municipal, Trabalhista
 * - Clientes (servidores, aposentados, pensionistas)
 * - Deadlines (prazos processuais)
 * - Documentos (petições, ofícios, certidões)
 * - Eventos processuais (timeline completa)
 * - Time entries (controle de honorários)
 * - AI queries (Perplexity + NVIDIA)
 */
export default class extends BaseSeeder {
  static environment = ['development']

  async run() {
    logger.info('🏛️  Iniciando seed de processos de precatórios...')
    logger.info('')

    const startTime = Date.now()
    let totalTenants = 0
    let totalCases = 0
    let totalClients = 0
    let totalDeadlines = 0
    let totalDocuments = 0
    let totalEvents = 0
    let totalAIQueries = 0

    // Criar 3-5 escritórios especializados em precatórios
    const numEscritorios = 5 // Todos os 5 escritórios famosos

    // Adicionar timestamp para garantir subdomains únicos em múltiplas execuções
    const timestamp = Date.now().toString().slice(-6)

    for (let i = 0; i < numEscritorios; i++) {
      const escritorioData = ESCRITORIOS_FAMOSOS[i]

      logger.info(`📂 Criando escritório ${i + 1}/${numEscritorios}: ${escritorioData.name}`)

      // 1. Criar Tenant (Escritório)
      const tenant = await TenantFactory.merge({
        name: escritorioData.name,
        subdomain: `${escritorioData.subdomain}-${timestamp}`,
        plan: escritorioData.plan,
        is_active: true,
      }).create()

      totalTenants++

      // 2. Criar Owner do escritório
      const owner = await UserFactory.merge({
        full_name: escritorioData.owner.full_name,
        email: escritorioData.owner.email,
      }).create()

      await TenantUserFactory.apply('owner')
        .merge({
          tenant_id: tenant.id,
          user_id: owner.id,
        })
        .create()

      // 3. Criar 2-3 advogados por escritório
      const numLawyers = i === 0 ? 3 : 2 // Primeiro escritório tem 3, demais 2
      const lawyers = []

      for (let j = 0; j < numLawyers; j++) {
        const lawyer = await UserFactory.create()
        await TenantUserFactory.apply('lawyer')
          .merge({
            tenant_id: tenant.id,
            user_id: lawyer.id,
          })
          .create()
        lawyers.push(lawyer)
      }

      // ========== EXECUTAR DENTRO DO CONTEXTO DO TENANT ==========
      await TenantContextService.run(
        {
          tenant_id: tenant.id,
          tenant,
          user_id: owner.id,
          tenant_user: null,
        },
        async () => {
          // Contadores locais para este escritório
          let localDeadlines = 0
          let localDocuments = 0
          let localEvents = 0

          // 4. Criar 5-10 processos de precatórios por escritório
          const numCases = i === 0 ? 10 : i === 1 ? 7 : 5 // Variação por escritório
          const tiposPrecatorio = Object.keys(TIPOS_PRECATORIO) as Array<
            keyof typeof TIPOS_PRECATORIO
          >

          for (let k = 0; k < numCases; k++) {
            const lawyer = lawyers[k % lawyers.length] // Distribuir casos entre lawyers
            const tipoPrecatorio = tiposPrecatorio[k % tiposPrecatorio.length]

            // 4a. Criar cliente (autor do processo)
            const cliente = await ClientFactory.apply('individual').create()
            totalClients++

            // 4b. Criar processo de precatório
            const caseStates = [tipoPrecatorio]

            // Adicionar states específicos baseado no índice
            if (k % 5 === 0) caseStates.push('atrasado') // 20% atrasados
            if (k % 7 === 0) caseStates.push('preferencial') // ~14% preferenciais
            if (k % 10 === 0) caseStates.push('cedido') // 10% cedidos

            let caseFactory = PrecatorioCaseFactory.merge({
              client_id: cliente.id,
              responsible_lawyer_id: lawyer.id,
            })

            // Aplicar states
            for (const state of caseStates) {
              caseFactory = caseFactory.apply(state as any)
            }

            const caso = await caseFactory.create()
            totalCases++

            // 4c. Criar Deadlines (3-5 por processo)
            const numDeadlines = 3 + (k % 3) // 3-5 deadlines
            for (let d = 0; d < numDeadlines; d++) {
              await DeadlineFactory.merge({
                case_id: caso.id,
                responsible_id: lawyer.id,
                deadline_date: DateTime.now().plus({ days: 30 + d * 15 }),
                description:
                  [
                    'Manifestação sobre cálculos do precatório',
                    'Prazo para atualização de dados cadastrais',
                    'Prazo para impugnação de valores',
                    'Prazo para apresentar documentação complementar',
                    'Prazo para informar cessão de precatório',
                  ][d] || 'Prazo processual geral',
                is_fatal: d % 2 === 0, // Metade são fatais
              }).create()
              totalDeadlines++
              localDeadlines++
            }

            // 4d. Criar Documentos (5-8 por processo)
            const numDocuments = 5 + (k % 4) // 5-8 documentos
            for (let doc = 0; doc < numDocuments; doc++) {
              const docData = DOCUMENTOS_PRECATORIO[doc % DOCUMENTOS_PRECATORIO.length]

              const filename = `${docData.title.toLowerCase().replace(/\s+/g, '-')}.pdf`

              await DocumentFactory.merge({
                case_id: caso.id,
                uploaded_by: lawyer.id,
                title: docData.title,
                description: docData.description,
                document_type: docData.type,
                access_level: 'case_team',
                file_path: `/documents/${caso.id}/${filename}`,
                original_filename: filename,
                mime_type: 'application/pdf',
                file_size: 150000 + doc * 50000, // 150KB - 500KB
              }).create()
              totalDocuments++
              localDocuments++
            }

            // 4e. Criar Eventos Processuais (timeline completa)
            for (const eventoConfig of EVENTOS_PRECATORIO) {
              await CaseEventFactory.merge({
                case_id: caso.id,
                created_by: lawyer.id,
                event_type: eventoConfig.type,
                description: eventoConfig.description,
                event_date: DateTime.now().plus({ days: eventoConfig.prazo_medio_dias }),
                source: 'manual',
              }).create()
              totalEvents++
              localEvents++
            }

            // 4f. Criar Time Entries (honorários)
            // 3-5 lançamentos de horas por processo
            const numTimeEntries = 3 + (k % 3)
            for (let te = 0; te < numTimeEntries; te++) {
              await TimeEntryFactory.merge({
                case_id: caso.id,
                user_id: lawyer.id,
                description:
                  [
                    'Análise de documentos do precatório',
                    'Elaboração de peça processual',
                    'Acompanhamento de requisição',
                    'Atualização de cálculos',
                    'Atendimento ao cliente sobre precatório',
                  ][te] || 'Trabalho geral no processo',
                duration_minutes: 60 + te * 30, // 1h a 2.5h
                hourly_rate: 300 + i * 50, // R$ 300-550/h dependendo do escritório
                billable: true,
              }).create()
            }
          }

          // 5. Criar AI Queries (Perplexity + NVIDIA) - 3-5 por escritório
          const numAIQueries = 3 + (i % 3) // 3-5 queries

          for (let q = 0; q < numAIQueries; q++) {
            const lawyerForQuery = lawyers[q % lawyers.length]

            // Alternar entre Perplexity e NVIDIA
            if (q % 2 === 0) {
              // Perplexity: jurisprudência ou legislação
              const queryState = ['jurisprudencia', 'legislacao', 'praticas'][q % 3] as
                | 'jurisprudencia'
                | 'legislacao'
                | 'praticas'

              await PerplexitySearchFactory.apply(queryState)
                .merge({
                  user_id: lawyerForQuery.id,
                })
                .create()
            } else {
              // NVIDIA: análise de documentos ou contratos
              const queryState = ['document_analysis', 'contract_review', 'code_generation'][
                q % 3
              ] as 'document_analysis' | 'contract_review' | 'code_generation'

              await NvidiaQueryFactory.apply(queryState)
                .merge({
                  user_id: lawyerForQuery.id,
                })
                .create()
            }

            totalAIQueries++
          }

          logger.info(`   ✅ ${numCases} processos criados`)
          logger.info(`   ✅ ${numCases} clientes criados`)
          logger.info(`   ✅ ${localDeadlines} deadlines criados`)
          logger.info(`   ✅ ${localDocuments} documentos criados`)
          logger.info(`   ✅ ${localEvents} eventos processuais criados`)
          logger.info(`   ✅ ${numAIQueries} AI queries criadas`)
          logger.info('')
        }
      )
    }

    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)

    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('✅ SEED DE PRECATÓRIOS CONCLUÍDO!')
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('')
    logger.info(`📊 Estatísticas:`)
    logger.info(`   • Escritórios criados: ${totalTenants}`)
    logger.info(`   • Processos de precatórios: ${totalCases}`)
    logger.info(`   • Clientes (autores): ${totalClients}`)
    logger.info(`   • Deadlines: ${totalDeadlines}`)
    logger.info(`   • Documentos: ${totalDocuments}`)
    logger.info(`   • Eventos processuais: ${totalEvents}`)
    logger.info(`   • AI Queries (Perplexity + NVIDIA): ${totalAIQueries}`)
    logger.info('')
    logger.info(`⏱️  Tempo de execução: ${duration}s`)
    logger.info('')
    logger.info('🎯 Escritórios criados:')
    ESCRITORIOS_FAMOSOS.forEach((esc, idx) => {
      if (idx < numEscritorios) {
        logger.info(`   ${idx + 1}. ${esc.name} (${esc.subdomain}-${timestamp})`)
        logger.info(`      Especialidades: ${esc.especialidades.join(', ')}`)
      }
    })
    logger.info('')
    logger.info('💡 Para testar, acesse:')
    logger.info(`   http://corino-adv-${timestamp}.localhost:3333`)
    logger.info(`   http://sandoval-adv-${timestamp}.localhost:3333`)
    logger.info('')
  }
}
