import {
  Database,
  FileSearch,
  HeartPulse,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  Upload,
  Users,
} from 'lucide-react'
import type { MenuConfig } from './types'

export const MENU_SIDEBAR: MenuConfig = [
  { heading: 'Operação' },
  { title: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { title: 'Imports SIOP', path: '/siop/imports', icon: Upload },
  { title: 'Precatórios', path: '/precatorios', icon: FileSearch },
  { title: 'Devedores', path: '/debtors', icon: Users },

  { heading: 'Administração' },
  { title: 'Health', path: '/admin/health', icon: HeartPulse },
  { title: 'Jobs', path: '/admin/jobs', icon: Database },

  { heading: 'Configurações' },
  { title: 'Tenant', path: '/settings/tenant', icon: Settings2 },
  { title: 'Permissões', path: '/settings/users', icon: ShieldCheck },
]
