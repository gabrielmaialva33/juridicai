import { Logo } from '@/components/layout/common/logo'
import { useState } from 'react'

interface MenuSection {
  title: string
  items: Array<{
    href: string
    icon: string
    label: string
    badge?: string
    submenu?: Array<{ href: string; label: string }>
  }>
}

export function Demo10Sidebar() {
  const [expandedItems, setExpandedItems] = useState<string[]>(['cases'])

  const toggleItem = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    )
  }

  const menuSections: MenuSection[] = [
    {
      title: 'Principal',
      items: [
        { href: '/dashboard', icon: 'ki-home-3', label: 'Dashboard' },
        { href: '/analytics', icon: 'ki-chart-simple', label: 'Análises' },
      ],
    },
    {
      title: 'Gestão',
      items: [
        {
          href: '/cases',
          icon: 'ki-document',
          label: 'Processos',
          badge: '12',
          submenu: [
            { href: '/cases/active', label: 'Em Andamento' },
            { href: '/cases/pending', label: 'Pendentes' },
            { href: '/cases/archived', label: 'Arquivados' },
          ],
        },
        {
          href: '/clients',
          icon: 'ki-profile-circle',
          label: 'Clientes',
          submenu: [
            { href: '/clients/active', label: 'Ativos' },
            { href: '/clients/potential', label: 'Potenciais' },
          ],
        },
        { href: '/deadlines', icon: 'ki-calendar', label: 'Prazos', badge: '3' },
        { href: '/documents', icon: 'ki-file', label: 'Documentos' },
      ],
    },
    {
      title: 'Comunicação',
      items: [
        { href: '/messages', icon: 'ki-messages', label: 'Mensagens', badge: '5' },
        { href: '/notifications', icon: 'ki-notification', label: 'Notificações' },
      ],
    },
    {
      title: 'Sistema',
      items: [
        {
          href: '/settings',
          icon: 'ki-setting-2',
          label: 'Configurações',
          submenu: [
            { href: '/settings/profile', label: 'Perfil' },
            { href: '/settings/team', label: 'Equipe' },
            { href: '/settings/billing', label: 'Faturamento' },
          ],
        },
        { href: '/help', icon: 'ki-question-2', label: 'Ajuda' },
      ],
    },
  ]

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <Logo />
        <div className="mt-3 px-3 py-2 bg-primary/10 rounded-md">
          <div className="text-xs text-muted-foreground">Tenant Ativo</div>
          <div className="text-sm font-medium">Advocacia Silva & Santos</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {menuSections.map((section) => (
          <div key={section.title} className="mb-6">
            <div className="px-3 mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {section.title}
              </h3>
            </div>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isExpanded = expandedItems.includes(item.label)
                const hasSubmenu = item.submenu && item.submenu.length > 0

                return (
                  <div key={item.label}>
                    {hasSubmenu ? (
                      <button
                        onClick={() => toggleItem(item.label)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <i className={`ki-filled ${item.icon}`}></i>
                          <span>{item.label}</span>
                          {item.badge && (
                            <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <i
                          className={`ki-filled ki-down text-xs transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        ></i>
                      </button>
                    ) : (
                      <a
                        href={item.href}
                        className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        <i className={`ki-filled ${item.icon}`}></i>
                        <span>{item.label}</span>
                        {item.badge && (
                          <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </a>
                    )}

                    {hasSubmenu && isExpanded && (
                      <div className="ml-9 mt-1 space-y-1">
                        {item.submenu!.map((subItem) => (
                          <a
                            key={subItem.href}
                            href={subItem.href}
                            className="block px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            {subItem.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2 bg-muted rounded-md">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
            AS
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">Advocacia Silva</div>
            <div className="text-xs text-muted-foreground">Plano Pro</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
