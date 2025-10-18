import { BarChart3, Calendar, Clock, FileText, FolderOpen, Home, Scale, Users } from 'lucide-react'

export interface Breadcrumb {
  label: string
  href?: string
  icon?: any
}

/**
 * Gera breadcrumbs baseado na URL atual
 */
export function getBreadcrumbs(pathname: string): Breadcrumb[] {
  const breadcrumbs: Breadcrumb[] = [
    {
      label: 'Home',
      href: '/dashboard',
      icon: Home,
    },
  ]

  // Remove trailing slash e divide o path
  const parts = pathname.replace(/\/$/, '').split('/').filter(Boolean)

  // Mapeamento de rotas para labels e ícones
  const routeConfig: Record<string, { label: string; icon?: any }> = {
    'dashboard': { label: 'Dashboard', icon: Home },
    'clients': { label: 'Clientes', icon: Users },
    'cases': { label: 'Processos', icon: FolderOpen },
    'documents': { label: 'Documentos', icon: FileText },
    'legal-matters': { label: 'Matérias Jurídicas', icon: Scale },
    'calendar': { label: 'Agenda', icon: Calendar },
    'time-entries': { label: 'Lançamentos de Horas', icon: Clock },
    'reports': { label: 'Relatórios', icon: BarChart3 },
    'settings': { label: 'Configurações' },
  }

  // Constrói os breadcrumbs baseado nas partes da URL
  let currentPath = ''
  parts.forEach((part, index) => {
    currentPath += `/${part}`
    const config = routeConfig[part]
    const isLast = index === parts.length - 1

    if (config) {
      breadcrumbs.push({
        label: config.label,
        href: isLast ? undefined : currentPath,
        icon: config.icon,
      })
    } else if (!Number.isNaN(Number(part))) {
      // Se for um ID numérico, pula (será tratado como detalhe)
      // Ex: /clients/123 -> mostra apenas "Clientes" > "Detalhes"
      breadcrumbs.push({
        label: 'Detalhes',
      })
    } else {
      // Fallback: capitaliza a primeira letra
      breadcrumbs.push({
        label: part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' '),
        href: isLast ? undefined : currentPath,
      })
    }
  })

  return breadcrumbs
}

/**
 * Retorna o título da página baseado na URL
 */
export function getPageTitle(pathname: string): string {
  const breadcrumbs = getBreadcrumbs(pathname)
  const lastBreadcrumb = breadcrumbs[breadcrumbs.length - 1]
  return lastBreadcrumb?.label || 'Dashboard'
}
