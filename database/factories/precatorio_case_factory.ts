import factory from '@adonisjs/lucid/factories'
import { FactoryContextContract } from '@adonisjs/lucid/types/factory'
import { DateTime } from 'luxon'
import Case from '#models/case'
import { ClientFactory } from './client_factory.js'
import { UserFactory } from './user_factory.js'
import {
  TIPOS_PRECATORIO,
  TRIBUNAIS_CNJ,
  PARTES_PRECATORIO,
  TAGS_PRECATORIOS,
} from '#database/seeders/helpers/precatorio_data'

/**
 * Generate a valid Brazilian CNJ format process number for specific tribunal
 */
function generateCNJNumberForTribunal(
  faker: any,
  tribunal: string,
  segmento: string,
  year?: number
): string {
  const sequential = faker.string.numeric(7)
  const processoYear = year || faker.date.past({ years: 5 }).getFullYear()
  const tribunalCodigo = TRIBUNAIS_CNJ[tribunal as keyof typeof TRIBUNAIS_CNJ]?.codigo || '26'

  // Simplified check digit calculation
  const base = sequential + processoYear.toString() + segmento + tribunalCodigo + '0100'
  const checkDigit = (Number.parseInt(base.substring(0, 10)) % 97).toString().padStart(2, '0')

  return `${sequential}-${checkDigit}.${processoYear}.${segmento}.${tribunalCodigo}.0100`
}

/**
 * Generate realistic case value for precatório (minimum 60 salários mínimos = R$ 91.080)
 */
function generatePrecatorioValue(faker: any, tipo: keyof typeof TIPOS_PRECATORIO): number {
  const config = TIPOS_PRECATORIO[tipo]
  return faker.number.float({
    min: config.valor_minimo,
    max: config.valor_maximo,
    fractionDigits: 2,
  })
}

/**
 * Get realistic tribunal for precatório type
 */
function getTribunalForTipo(faker: any, tipo: keyof typeof TIPOS_PRECATORIO): string {
  const config = TIPOS_PRECATORIO[tipo]
  return faker.helpers.arrayElement(config.tribunais)
}

/**
 * Generate parties for precatório case
 */
function generatePrecatorioParties(
  faker: any,
  tipo: keyof typeof TIPOS_PRECATORIO,
  clientType: 'individual' | 'company'
) {
  const isIndividual = clientType === 'individual'
  const autorTipo = isIndividual ? 'individual' : 'juridica'
  const autorDescricao = faker.helpers.arrayElement(PARTES_PRECATORIO.autores[autorTipo])

  let reuCategory: 'federal' | 'estadual' | 'municipal'
  if (tipo === 'federal') reuCategory = 'federal'
  else if (tipo === 'municipal') reuCategory = 'municipal'
  else reuCategory = 'estadual'

  const reuNome = faker.helpers.arrayElement(PARTES_PRECATORIO.reus[reuCategory])

  return {
    plaintiffs: [
      {
        name: isIndividual ? faker.person.fullName() : faker.company.name(),
        role: `Autor (${autorDescricao})`,
      },
    ],
    defendants: [
      {
        name: reuNome,
        role: 'Réu (Fazenda Pública)',
      },
    ],
    others: [
      {
        name: 'Ministério Público',
        role: 'Fiscal da Lei',
      },
    ],
  }
}

/**
 * Generate realistic description for precatório case
 */
function generatePrecatorioDescription(faker: any, tipo: keyof typeof TIPOS_PRECATORIO): string {
  const config = TIPOS_PRECATORIO[tipo]
  const origem = faker.helpers.arrayElement(config.origem_comum)

  const descricoes = {
    federal: [
      `Ação de cobrança de diferenças de ${origem} não pagas pelo ente público federal. Após trânsito em julgado, foi expedido precatório federal para pagamento do débito atualizado.`,
      `Processo visando o recebimento de verbas de ${origem} devidas pela União. Sentença procedente transitada em julgado determinou a expedição de precatório.`,
      `Ação contra a União pleiteando valores referentes a ${origem}. Com o trânsito em julgado da condenação, aguarda-se o pagamento via precatório federal.`,
    ],
    estadual: [
      `Ação de cobrança contra o Estado pleiteando valores de ${origem}. Após decisão favorável transitada em julgado, foi requisitado precatório estadual.`,
      `Processo judicial contra a Fazenda Estadual para recebimento de ${origem}. Condenação definitiva ensejou a expedição de precatório.`,
      `Demanda contra ente estadual referente a ${origem}. Com sentença procedente e trânsito em julgado, aguarda-se pagamento por precatório.`,
    ],
    municipal: [
      `Ação contra o Município visando o recebimento de valores de ${origem}. Decisão condenatória transitada em julgado gerou precatório municipal.`,
      `Processo de cobrança contra a Prefeitura referente a ${origem}. Após trânsito em julgado, foi expedido ofício requisitório de precatório.`,
      `Demanda judicial contra ente municipal pleiteando ${origem}. Sentença procedente definitiva determinou pagamento via precatório.`,
    ],
    trabalhista: [
      `Reclamação trabalhista na Justiça do Trabalho pleiteando ${origem}. Após trânsito em julgado da condenação, foi expedido precatório trabalhista.`,
      `Ação trabalhista contra ente público visando o pagamento de ${origem}. Decisão favorável definitiva gerou precatório.`,
      `Processo na Justiça do Trabalho contra órgão público referente a ${origem}. Com trânsito em julgado, aguarda-se pagamento por precatório.`,
    ],
  }

  return faker.helpers.arrayElement(descricoes[tipo])
}

/**
 * Factory for Precatório cases - extends base CaseFactory
 */
export const PrecatorioCaseFactory = factory
  .define(Case, async ({ faker }: FactoryContextContract) => {
    // Default: precatório federal (INSS)
    const tipo: keyof typeof TIPOS_PRECATORIO = 'federal'
    const tribunal = getTribunalForTipo(faker, tipo)
    const config = TIPOS_PRECATORIO[tipo]

    return {
      case_number: generateCNJNumberForTribunal(faker, tribunal, config.segmento_cnj),
      internal_number: `PREC-${faker.string.numeric(6)}`,
      case_type: config.case_type,
      description: generatePrecatorioDescription(faker, tipo),
      status: 'active' as const,
      priority: faker.helpers.arrayElement(['medium', 'high', 'urgent'] as const),
      court: TRIBUNAIS_CNJ[tribunal as keyof typeof TRIBUNAIS_CNJ]?.nome || tribunal,
      court_instance: faker.helpers.arrayElement(['1ª instância', '2ª instância'] as const),
      case_value: generatePrecatorioValue(faker, tipo),
      team_members: [],
      parties: generatePrecatorioParties(faker, tipo, 'individual'),
      tags: faker.helpers.arrayElements(TAGS_PRECATORIOS, { min: 3, max: 5 }),
      custom_fields: {
        tipo_precatorio: tipo,
        natureza: 'alimentar', // Precatórios alimentares têm preferência
        ano_expedicao: faker.date.past({ years: config.prazo_medio_anos }).getFullYear(),
        posicao_fila: faker.number.int({ min: 1, max: 500 }),
        valor_atualizado: null, // Será calculado posteriormente
        data_inclusao_lista: faker.date.past({ years: 2 }).toISOString(),
      },
      filed_at: DateTime.fromJSDate(faker.date.past({ years: 6 })),
      closed_at: null,
    }
  })
  .relation('client', () => ClientFactory)
  .relation('responsible_lawyer', () => UserFactory)

  // ==================== STATES POR TIPO DE PRECATÓRIO ====================

  .state('federal', (caseModel, ctx) => {
    const { faker } = ctx
    const tipo: keyof typeof TIPOS_PRECATORIO = 'federal'
    const tribunal = getTribunalForTipo(faker, tipo)
    const config = TIPOS_PRECATORIO[tipo]

    caseModel.case_type = config.case_type
    caseModel.case_number = generateCNJNumberForTribunal(faker, tribunal, config.segmento_cnj)
    caseModel.court = TRIBUNAIS_CNJ[tribunal as keyof typeof TRIBUNAIS_CNJ]?.nome || tribunal
    caseModel.case_value = generatePrecatorioValue(faker, tipo)
    caseModel.description = generatePrecatorioDescription(faker, tipo)
    caseModel.parties = generatePrecatorioParties(faker, tipo, 'individual')
    caseModel.tags = ['precatorio', 'federal', 'alimentar', 'inss']
    caseModel.custom_fields = {
      tipo_precatorio: tipo,
      natureza: 'alimentar',
      ano_expedicao: faker.date.past({ years: config.prazo_medio_anos }).getFullYear(),
      posicao_fila: faker.number.int({ min: 1, max: 200 }),
    }
  })

  .state('estadual', (caseModel, ctx) => {
    const { faker } = ctx
    const tipo: keyof typeof TIPOS_PRECATORIO = 'estadual'
    const tribunal = getTribunalForTipo(faker, tipo)
    const config = TIPOS_PRECATORIO[tipo]

    caseModel.case_type = config.case_type
    caseModel.case_number = generateCNJNumberForTribunal(faker, tribunal, config.segmento_cnj)
    caseModel.court = TRIBUNAIS_CNJ[tribunal as keyof typeof TRIBUNAIS_CNJ]?.nome || tribunal
    caseModel.case_value = generatePrecatorioValue(faker, tipo)
    caseModel.description = generatePrecatorioDescription(faker, tipo)
    caseModel.parties = generatePrecatorioParties(faker, tipo, 'individual')
    caseModel.tags = ['precatorio', 'estadual', 'servidor-publico', 'alimentar']
    caseModel.custom_fields = {
      tipo_precatorio: tipo,
      natureza: 'alimentar',
      ano_expedicao: faker.date.past({ years: config.prazo_medio_anos }).getFullYear(),
      posicao_fila: faker.number.int({ min: 1, max: 800 }),
    }
  })

  .state('municipal', (caseModel, ctx) => {
    const { faker } = ctx
    const tipo: keyof typeof TIPOS_PRECATORIO = 'municipal'
    const tribunal = getTribunalForTipo(faker, tipo)
    const config = TIPOS_PRECATORIO[tipo]

    caseModel.case_type = config.case_type
    caseModel.case_number = generateCNJNumberForTribunal(faker, tribunal, config.segmento_cnj)
    caseModel.court = TRIBUNAIS_CNJ[tribunal as keyof typeof TRIBUNAIS_CNJ]?.nome || tribunal
    caseModel.case_value = generatePrecatorioValue(faker, tipo)
    caseModel.description = generatePrecatorioDescription(faker, tipo)
    caseModel.parties = generatePrecatorioParties(faker, tipo, 'individual')
    caseModel.tags = ['precatorio', 'municipal', 'servidor-publico', 'alimentar']
    caseModel.custom_fields = {
      tipo_precatorio: tipo,
      natureza: 'alimentar',
      ano_expedicao: faker.date.past({ years: config.prazo_medio_anos }).getFullYear(),
      posicao_fila: faker.number.int({ min: 1, max: 300 }),
    }
  })

  .state('trabalhista', (caseModel, ctx) => {
    const { faker } = ctx
    const tipo: keyof typeof TIPOS_PRECATORIO = 'trabalhista'
    const tribunal = getTribunalForTipo(faker, tipo)
    const config = TIPOS_PRECATORIO[tipo]

    caseModel.case_type = config.case_type
    caseModel.case_number = generateCNJNumberForTribunal(faker, tribunal, config.segmento_cnj)
    caseModel.court = TRIBUNAIS_CNJ[tribunal as keyof typeof TRIBUNAIS_CNJ]?.nome || tribunal
    caseModel.case_value = generatePrecatorioValue(faker, tipo)
    caseModel.description = generatePrecatorioDescription(faker, tipo)
    caseModel.parties = generatePrecatorioParties(faker, tipo, 'individual')
    caseModel.tags = ['precatorio', 'trabalhista', 'alimentar', 'verbas-rescisorias']
    caseModel.custom_fields = {
      tipo_precatorio: tipo,
      natureza: 'alimentar',
      ano_expedicao: faker.date.past({ years: config.prazo_medio_anos }).getFullYear(),
      posicao_fila: faker.number.int({ min: 1, max: 150 }),
    }
  })

  // ==================== STATES POR NATUREZA ====================

  .state('alimentar', (caseModel) => {
    // Precatórios alimentares têm preferência (servidores, aposentados, pensionistas)
    caseModel.priority = 'high'
    caseModel.tags = [...(caseModel.tags || []), 'alimentar', 'preferencial']
    caseModel.custom_fields = {
      ...caseModel.custom_fields,
      natureza: 'alimentar',
      preferencia: 'alimentar',
    }
  })

  .state('comum', (caseModel) => {
    // Precatórios comuns (ex: desapropriação, indenizações)
    caseModel.custom_fields = {
      ...caseModel.custom_fields,
      natureza: 'comum',
    }
    caseModel.tags = [...(caseModel.tags || []).filter((t) => t !== 'alimentar'), 'comum']
  })

  // ==================== STATES POR SITUAÇÃO ====================

  .state('atrasado', (caseModel, ctx) => {
    const { faker } = ctx
    // Precatório com anos de atraso (comum em SP)
    caseModel.priority = 'urgent'
    caseModel.tags = [...(caseModel.tags || []), 'atrasado', 'urgente']
    caseModel.custom_fields = {
      ...caseModel.custom_fields,
      ano_expedicao: faker.date.past({ years: 15 }).getFullYear(), // 15+ anos atrás
      posicao_fila: faker.number.int({ min: 1, max: 50 }), // Deve estar no topo da fila
      atraso_anos: faker.number.int({ min: 10, max: 15 }),
    }
  })

  .state('preferencial', (caseModel, ctx) => {
    const { faker } = ctx
    // Credor idoso ou portador de doença grave (pagamento preferencial)
    caseModel.priority = 'urgent'
    caseModel.tags = [...(caseModel.tags || []), 'preferencial', 'idoso', 'urgente']
    caseModel.custom_fields = {
      ...caseModel.custom_fields,
      preferencia: 'idoso_doenca_grave',
      idade_credor: faker.number.int({ min: 65, max: 85 }),
      portador_doenca_grave: faker.datatype.boolean(),
    }
  })

  .state('cedido', (caseModel, ctx) => {
    const { faker } = ctx
    // Precatório cedido a terceiro
    caseModel.tags = [...(caseModel.tags || []), 'cessao', 'cedido']
    caseModel.custom_fields = {
      ...caseModel.custom_fields,
      cedido: true,
      data_cessao: faker.date.recent({ days: 180 }).toISOString(),
      cessionario: faker.company.name(),
      valor_cessao_percentual: faker.number.int({ min: 60, max: 85 }), // Desconto de 15-40%
    }
  })

  .state('complementar', (caseModel) => {
    // Precatório complementar (requisição adicional ao mesmo processo)
    caseModel.tags = [...(caseModel.tags || []), 'complementar']
    caseModel.internal_number = `${caseModel.internal_number}-COMPL`
    caseModel.custom_fields = {
      ...caseModel.custom_fields,
      complementar: true,
      precatorio_principal: `PREC-${Math.floor(Math.random() * 100000)}`,
    }
  })

  .build()
