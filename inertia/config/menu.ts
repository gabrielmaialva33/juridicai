import { ComponentType } from 'react'
import { LucideIcon } from 'lucide-react'
import {
  Home,
  Users,
  FolderOpen,
  Scale,
  FileText,
  Calendar,
  DollarSign,
  BarChart3,
  Settings,
} from 'lucide-react'

export interface MenuItem {
  path?: string
  title: string
  icon?: LucideIcon | ComponentType
  heading?: string
  disabled?: boolean
  children?: MenuItem[]
  collapse?: boolean
  collapseTitle?: string
  expandTitle?: string
}

export type MenuConfig = MenuItem[]

/**
 * Sidebar menu configuration for law firm management
 */
export const MENU_SIDEBAR: MenuConfig = [
  {
    heading: 'Painel',
  },
  {
    path: '/dashboard',
    title: 'Dashboard',
    icon: Home,
  },
  {
    heading: 'Gestão',
  },
  {
    path: '/clients',
    title: 'Clientes',
    icon: Users,
  },
  {
    path: '/cases',
    title: 'Processos',
    icon: FolderOpen,
  },
  {
    path: '/legal-matters',
    title: 'Matérias Jurídicas',
    icon: Scale,
  },
  {
    path: '/documents',
    title: 'Documentos',
    icon: FileText,
  },
  {
    heading: 'Operacional',
  },
  {
    path: '/calendar',
    title: 'Agenda',
    icon: Calendar,
  },
  {
    path: '/time-entries',
    title: 'Lançamentos de Horas',
    icon: DollarSign,
  },
  {
    heading: 'Relatórios',
  },
  {
    path: '/reports',
    title: 'Relatórios',
    icon: BarChart3,
  },
]
