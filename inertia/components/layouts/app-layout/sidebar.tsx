import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useLayout } from './context'
import { SidebarHeader } from './sidebar-header'
import { SidebarMenu } from './sidebar-menu'
import { SidebarFooter } from './sidebar-footer'

const SIDEBAR_WIDTH = 264
const SIDEBAR_WIDTH_COLLAPSE = 72

export function Sidebar() {
  const { sidebarCollapse } = useLayout()
  const [isHovered, setIsHovered] = useState(false)

  const isExpanded = !sidebarCollapse || isHovered
  const currentWidth = sidebarCollapse && !isHovered ? SIDEBAR_WIDTH_COLLAPSE : SIDEBAR_WIDTH

  return (
    <aside
      className={cn(
        'bg-card lg:border-e lg:border-border lg:fixed lg:top-0 lg:bottom-0 lg:z-20 lg:flex flex-col items-stretch shrink-0 hidden',
        'transition-[width,max-width] duration-300 ease-in-out',
        sidebarCollapse && !isHovered && 'overflow-hidden',
        sidebarCollapse && isHovered && 'shadow-xl'
      )}
      style={{ width: currentWidth, maxWidth: currentWidth }}
      onMouseEnter={() => sidebarCollapse && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <SidebarHeader isExpanded={isExpanded} />
      <div
        className="flex-1 overflow-y-auto min-h-0"
        style={{ width: isExpanded ? SIDEBAR_WIDTH : '100%' }}
      >
        <SidebarMenu isExpanded={isExpanded} />
      </div>
      <div className="shrink-0" style={{ width: isExpanded ? SIDEBAR_WIDTH : '100%' }}>
        <SidebarFooter isExpanded={isExpanded} />
      </div>
    </aside>
  )
}

export const SIDEBAR_SIZES = { SIDEBAR_WIDTH, SIDEBAR_WIDTH_COLLAPSE }
