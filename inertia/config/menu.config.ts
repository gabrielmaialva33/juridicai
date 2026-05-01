import { Building2, Columns3, FileSearch, LineChart, Target, Upload } from 'lucide-react'
import type { MenuConfig } from './types'

export const MENU_SIDEBAR: MenuConfig = [
  { heading: 'Operação' },
  { title: 'Mesa de Operações', path: '/operations/desk', icon: LineChart },
  { title: 'Inbox A+', path: '/operations/opportunities', icon: Target },
  { title: 'Pipeline', path: '/operations/pipeline', icon: Columns3 },

  { heading: 'Inteligência' },
  { title: 'Base de Ativos', path: '/precatorios', icon: FileSearch },
  { title: 'Devedores', path: '/debtors', icon: Building2 },
  { title: 'Fontes de Dados', path: '/siop/imports', icon: Upload },
]
