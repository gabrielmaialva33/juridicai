import {
  Database,
  Building2,
  Columns3,
  FileSearch,
  HeartPulse,
  LayoutDashboard,
  LineChart,
  Settings2,
  ShieldCheck,
  Target,
  Upload,
} from 'lucide-react'
import type { MenuConfig } from './types'

export const MENU_SIDEBAR: MenuConfig = [
  { heading: 'Mesa' },
  { title: 'Mesa de Operações', path: '/operations/desk', icon: LineChart },
  { title: 'Inbox A+', path: '/operations/opportunities', icon: Target },
  { title: 'Pipeline', path: '/operations/pipeline', icon: Columns3 },

  { heading: 'Originação' },
  { title: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { title: 'Imports SIOP', path: '/siop/imports', icon: Upload },
  { title: 'Precatórios', path: '/precatorios', icon: FileSearch },
  { title: 'Devedores', path: '/debtors', icon: Building2 },

  { heading: 'Administração' },
  { title: 'Health', path: '/admin/health', icon: HeartPulse },
  { title: 'Jobs', path: '/admin/jobs', icon: Database },

  { heading: 'Configurações' },
  { title: 'Tenant', path: '/settings/tenant', icon: Settings2 },
  { title: 'Permissões', path: '/settings/users', icon: ShieldCheck },
]
