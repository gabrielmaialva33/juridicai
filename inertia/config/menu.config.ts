import { Building2, Columns3, FileSearch, LineChart, Target, Upload } from 'lucide-react'
import type { MenuConfig } from './types'

export const MENU_SIDEBAR: MenuConfig = [
  { heading: 'Atendimento' },
  { title: 'Painel do Escritório', path: '/operations/desk', icon: LineChart },
  { title: 'Triagem de Créditos', path: '/operations/opportunities', icon: Target },
  { title: 'Acompanhamento', path: '/operations/pipeline', icon: Columns3 },

  { heading: 'Base jurídica' },
  { title: 'Créditos Monitorados', path: '/precatorios', icon: FileSearch },
  { title: 'Devedores', path: '/debtors', icon: Building2 },
  { title: 'Fontes de Dados', path: '/siop/imports', icon: Upload },
]
