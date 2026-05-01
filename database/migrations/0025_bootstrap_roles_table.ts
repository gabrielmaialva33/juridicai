import { BaseSchema } from '@adonisjs/lucid/schema'

const ROLES = [
  {
    slug: 'owner',
    name: 'Sócio gestor',
    description: 'Acesso completo para configurar a organização, integrações e operação.',
  },
  {
    slug: 'advocate',
    name: 'Advogado responsável',
    description: 'Conduz análise jurídica, atendimento ao cliente e decisões de encaminhamento.',
  },
  {
    slug: 'operator',
    name: 'Operador de atendimento',
    description: 'Acompanha triagem, contatos, prazos e movimentações operacionais.',
  },
  {
    slug: 'analyst',
    name: 'Analista jurídico',
    description: 'Pesquisa créditos, devedores e sinais públicos para apoiar a triagem.',
  },
] as const

export default class extends BaseSchema {
  async up() {
    for (const role of ROLES) {
      await this.db
        .table('roles')
        .insert(role)
        .onConflict('slug')
        .merge({
          name: role.name,
          description: role.description,
          updated_at: this.raw('now()'),
        })
    }
  }

  async down() {
    await this.db
      .from('roles')
      .whereIn(
        'slug',
        ROLES.map((role) => role.slug)
      )
      .delete()
  }
}
