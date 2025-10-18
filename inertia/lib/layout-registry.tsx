import { Demo6Layout } from '@/layouts/demo6-layout'
import type { LayoutKey, LayoutRegistry } from '@/types/layout'

import { ReactNode } from 'react'

// Temporary placeholder layout component for demos not yet implemented
// This allows the infrastructure to work while we implement each demo progressively
function PlaceholderLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Layout em desenvolvimento</h1>
        <p className="text-muted-foreground mb-4">Este layout será implementado em breve</p>
        <div className="mt-8 max-w-4xl">{children}</div>
      </div>
    </div>
  )
}

export const LAYOUTS: LayoutRegistry = {
  demo1: {
    key: 'demo1',
    name: 'Classic Sidebar',
    description: 'Traditional left sidebar with fixed header',
    component: PlaceholderLayout,
    features: ['Left sidebar', 'Fixed header', 'Collapsible', 'Accordion menu'],
    sidebarWidth: 'auto',
    headerHeight: '60px',
    category: 'sidebar',
  },
  demo2: {
    key: 'demo2',
    name: 'Top Navigation',
    description: 'Large header with horizontal navigation',
    component: PlaceholderLayout,
    features: ['Top menu', 'No sidebar', 'Sticky header', 'Dropdown menus'],
    headerHeight: '100px',
    category: 'top-nav',
  },
  demo3: {
    key: 'demo3',
    name: 'Icon Sidebar Compact',
    description: 'Narrow 58px icon bar with top navbar',
    component: PlaceholderLayout,
    features: ['Icon sidebar', 'Top navbar', 'Compact', 'Space-efficient'],
    sidebarWidth: '58px',
    headerHeight: '58px',
    category: 'compact',
  },
  demo4: {
    key: 'demo4',
    name: 'Dual Sidebar',
    description: 'Icon bar + expandable secondary panel',
    component: PlaceholderLayout,
    features: ['Primary sidebar', 'Secondary panel', 'Two-column', 'Icon + content'],
    sidebarWidth: '290px',
    headerHeight: '60px',
    category: 'hybrid',
  },
  demo5: {
    key: 'demo5',
    name: 'Breadcrumb Navigation',
    description: 'Compact header with breadcrumb navigation',
    component: PlaceholderLayout,
    features: ['Breadcrumb', 'Team switcher', 'Compact header', 'Contextual nav'],
    sidebarWidth: '200px',
    headerHeight: '54px',
    category: 'hybrid',
  },
  demo6: {
    key: 'demo6',
    name: 'Sidebar with Search',
    description: 'Professional sidebar with integrated search',
    component: Demo6Layout,
    features: ['Search bar', '270px sidebar', 'Mobile drawer', 'Clean design'],
    sidebarWidth: '270px',
    headerHeight: '60px',
    category: 'sidebar',
  },
  demo7: {
    key: 'demo7',
    name: 'Mega Menu',
    description: 'Large header with mega menu dropdowns',
    component: PlaceholderLayout,
    features: ['Mega menu', 'Multi-column', 'Large header', 'No sidebar'],
    headerHeight: '95px',
    category: 'top-nav',
  },
  demo8: {
    key: 'demo8',
    name: 'Icon Sidebar 90px',
    description: 'Wider icon sidebar with labels',
    component: PlaceholderLayout,
    features: ['Icon + label', 'CMS style', '90px sidebar', 'Dropdown menus'],
    sidebarWidth: '90px',
    headerHeight: '60px',
    category: 'compact',
  },
  demo9: {
    key: 'demo9',
    name: 'Team Switcher',
    description: 'Header with team/organization switchers',
    component: PlaceholderLayout,
    features: ['Team switcher', 'Shop switcher', 'Header search', 'Multi-tenant'],
    headerHeight: '78px',
    category: 'top-nav',
  },
  demo10: {
    key: 'demo10',
    name: 'Dark Sidebar',
    description: 'Dark themed sidebar with search and actions',
    component: PlaceholderLayout,
    features: ['Dark theme', 'Search bar', 'Action buttons', '270px sidebar'],
    sidebarWidth: '270px',
    headerHeight: '60px',
    category: 'sidebar',
  },
}

export const DEFAULT_LAYOUT: LayoutKey = 'demo6'

export function getLayout(key: LayoutKey) {
  return LAYOUTS[key] || LAYOUTS[DEFAULT_LAYOUT]
}

export function getAllLayouts() {
  return Object.values(LAYOUTS)
}

export function getLayoutsByCategory(category: LayoutRegistry[LayoutKey]['category']) {
  return Object.values(LAYOUTS).filter((layout) => layout.category === category)
}
