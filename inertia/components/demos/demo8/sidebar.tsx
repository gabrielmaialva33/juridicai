import { Logo } from '@/components/layout/common/logo'
import { useState } from 'react'

interface AccordionItem {
  id: string
  icon: string
  label: string
  items: Array<{ href: string; label: string }>
}

export function Demo8Sidebar() {
  const [openSections, setOpenSections] = useState<string[]>(['dashboard'])

  const toggleSection = (id: string) => {
    setOpenSections((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const menuSections: AccordionItem[] = [
    {
      id: 'dashboard',
      icon: 'ki-home-3',
      label: 'Dashboard',
      items: [
        { href: '/dashboard', label: 'Visão Geral' },
        { href: '/dashboard/analytics', label: 'Análises' },
        { href: '/dashboard/reports', label: 'Relatórios' },
      ],
    },
    {
      id: 'cases',
      icon: 'ki-document',
      label: 'Processos',
      items: [
        { href: '/cases', label: 'Todos Processos' },
        { href: '/cases/active', label: 'Em Andamento' },
        { href: '/cases/pending', label: 'Pendentes' },
        { href: '/cases/archived', label: 'Arquivados' },
      ],
    },
    {
      id: 'clients',
      icon: 'ki-profile-circle',
      label: 'Clientes',
      items: [
        { href: '/clients', label: 'Todos Clientes' },
        { href: '/clients/active', label: 'Ativos' },
        { href: '/clients/potential', label: 'Potenciais' },
        { href: '/clients/inactive', label: 'Inativos' },
      ],
    },
    {
      id: 'deadlines',
      icon: 'ki-calendar',
      label: 'Prazos',
      items: [
        { href: '/deadlines', label: 'Calendário' },
        { href: '/deadlines/today', label: 'Hoje' },
        { href: '/deadlines/week', label: 'Esta Semana' },
        { href: '/deadlines/overdue', label: 'Atrasados' },
      ],
    },
    {
      id: 'documents',
      icon: 'ki-file',
      label: 'Documentos',
      items: [
        { href: '/documents', label: 'Todos Documentos' },
        { href: '/documents/templates', label: 'Modelos' },
        { href: '/documents/drafts', label: 'Rascunhos' },
      ],
    },
    {
      id: 'settings',
      icon: 'ki-setting-2',
      label: 'Configurações',
      items: [
        { href: '/settings/profile', label: 'Perfil' },
        { href: '/settings/team', label: 'Equipe' },
        { href: '/settings/billing', label: 'Faturamento' },
        { href: '/settings/integrations', label: 'Integrações' },
      ],
    },
  ]

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <Logo />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <div className="space-y-1">
          {menuSections.map((section) => {
            const isOpen = openSections.includes(section.id)

            return (
              <div key={section.id} className="space-y-1">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <i className={`ki-filled ${section.icon}`}></i>
                    <span>{section.label}</span>
                  </div>
                  <i
                    className={`ki-filled ki-down text-xs transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  ></i>
                </button>

                {isOpen && (
                  <div className="ml-6 space-y-1">
                    {section.items.map((item) => (
                      <a
                        key={item.href}
                        href={item.href}
                        className="block px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>
    </aside>
  )
}
