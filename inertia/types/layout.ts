import { ComponentType, ReactNode } from 'react'

export type LayoutKey =
  | 'demo1'
  | 'demo2'
  | 'demo3'
  | 'demo4'
  | 'demo5'
  | 'demo6'
  | 'demo7'
  | 'demo8'
  | 'demo9'
  | 'demo10'

export interface LayoutConfig {
  key: LayoutKey
  name: string
  description: string
  component: ComponentType<{ children: ReactNode }>
  preview?: string
  features: string[]
  sidebarWidth?: string
  headerHeight?: string
  category: 'sidebar' | 'top-nav' | 'hybrid' | 'compact'
}

export type LayoutRegistry = Record<LayoutKey, LayoutConfig>
