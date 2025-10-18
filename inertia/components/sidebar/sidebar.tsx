import { Link, usePage } from '@inertiajs/react'
import { cn } from '@/lib/utils'
import { Home, Users, Briefcase, Clock, FileText, Building2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface SidebarProps {
  collapsed: boolean
}

const menuItems = [
  {
    name: 'Dashboard',
    href: '/',
    icon: Home,
  },
  {
    name: 'Clientes',
    href: '/clients',
    icon: Users,
  },
  {
    name: 'Processos',
    href: '/cases',
    icon: Briefcase,
  },
  {
    name: 'Prazos',
    href: '/deadlines',
    icon: Clock,
  },
  {
    name: 'Documentos',
    href: '/documents',
    icon: FileText,
  },
  {
    name: 'Empresas',
    href: '/companies',
    icon: Building2,
  },
]

export function Sidebar({ collapsed }: SidebarProps) {
  const { url } = usePage()

  return (
    <nav className="flex-1 overflow-y-auto py-4 px-2">
      <ul className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = url === item.href || url.startsWith(item.href + '/')

          const linkContent = (
            <Link
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                'hover:bg-gray-100 dark:hover:bg-gray-700',
                isActive &&
                  'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium',
                !isActive && 'text-gray-700 dark:text-gray-300',
                collapsed && 'justify-center px-2'
              )}
            >
              <Icon className={cn('shrink-0', collapsed ? 'w-5 h-5' : 'w-5 h-5')} />
              {!collapsed && <span className="text-sm">{item.name}</span>}
            </Link>
          )

          if (collapsed) {
            return (
              <li key={item.href}>
                <Tooltip>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{item.name}</p>
                  </TooltipContent>
                </Tooltip>
              </li>
            )
          }

          return <li key={item.href}>{linkContent}</li>
        })}
      </ul>
    </nav>
  )
}
