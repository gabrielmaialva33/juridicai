import { Logo } from '@/components/layout/common/logo'
import { useState } from 'react'

export function Demo7Sidebar() {
  const [activeTab, setActiveTab] = useState('main')

  const tabs = [
    { id: 'main', icon: 'ki-home-3', label: 'Principal' },
    { id: 'cases', icon: 'ki-document', label: 'Processos' },
    { id: 'clients', icon: 'ki-profile-circle', label: 'Clientes' },
    { id: 'analytics', icon: 'ki-chart-simple', label: 'Análises' },
  ]

  const getMenuItems = (tabId: string) => {
    switch (tabId) {
      case 'main':
        return [
          { href: '/dashboard', icon: 'ki-home-3', label: 'Dashboard' },
          { href: '/calendar', icon: 'ki-calendar', label: 'Calendário' },
          { href: '/tasks', icon: 'ki-check-circle', label: 'Tarefas' },
        ]
      case 'cases':
        return [
          { href: '/cases', icon: 'ki-document', label: 'Todos Processos' },
          { href: '/cases/active', icon: 'ki-time', label: 'Em Andamento' },
          { href: '/cases/archived', icon: 'ki-archive', label: 'Arquivados' },
        ]
      case 'clients':
        return [
          { href: '/clients', icon: 'ki-profile-circle', label: 'Todos Clientes' },
          { href: '/clients/active', icon: 'ki-star', label: 'Ativos' },
          { href: '/clients/potential', icon: 'ki-user', label: 'Potenciais' },
        ]
      case 'analytics':
        return [
          { href: '/analytics/overview', icon: 'ki-chart-line', label: 'Visão Geral' },
          { href: '/analytics/performance', icon: 'ki-graph', label: 'Performance' },
          { href: '/analytics/reports', icon: 'ki-file-sheet', label: 'Relatórios' },
        ]
      default:
        return []
    }
  }

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <Logo />
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            title={tab.label}
          >
            <i className={`ki-filled ${tab.icon} text-lg`}></i>
            <span className="hidden xl:block">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <div className="space-y-1">
          {getMenuItems(activeTab).map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <i className={`ki-filled ${item.icon}`}></i>
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      </nav>
    </aside>
  )
}
