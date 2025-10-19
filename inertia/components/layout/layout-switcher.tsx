import { useState } from 'react'
import { useLayout } from '@/hooks/use_layout'
import type { LayoutKey } from '@/types/layout'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function LayoutSwitcher() {
  const { currentLayout, layoutConfig, allLayoutsList, changeLayout } = useLayout()
  const [open, setOpen] = useState(false)

  const handleLayoutChange = (key: LayoutKey) => {
    changeLayout(key)
    setOpen(false)
    // Reload to apply new layout
    window.location.reload()
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'sidebar':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'top-nav':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'hybrid':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
      case 'compact':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="hidden sm:inline-flex gap-1.5 sm:gap-2 text-xs sm:text-sm"
        >
          <i className="ki-filled ki-setting-2 text-sm sm:text-base" />
          <span className="hidden sm:inline">Layout:</span>
          <span className="hidden md:inline">{layoutConfig.name}</span>
          <span className="md:hidden">Layouts</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[95vw] sm:max-w-3xl lg:max-w-5xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-2 sm:space-y-3">
          <DialogTitle className="text-lg sm:text-xl">Escolha o Layout do Dashboard</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Teste diferentes layouts do Metronic v9.3.2 e escolha o que melhor se adequa ao seu
            fluxo de trabalho
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-4 sm:mt-6">
          {allLayoutsList.map((layout) => (
            <button
              key={layout.key}
              onClick={() => handleLayoutChange(layout.key)}
              className={`group relative p-4 border-2 rounded-lg text-left transition-all hover:border-primary hover:shadow-md ${
                currentLayout === layout.key
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'border-border hover:bg-accent'
              }`}
            >
              {/* Category Badge */}
              <div className="absolute top-2 right-2">
                <Badge variant="secondary" className={getCategoryColor(layout.category)}>
                  {layout.category}
                </Badge>
              </div>

              {/* Active Indicator */}
              {currentLayout === layout.key && (
                <div className="absolute top-2 left-2">
                  <i className="ki-filled ki-check-circle text-primary text-xl" />
                </div>
              )}

              {/* Layout Info */}
              <div className="mt-6">
                <h3 className="font-semibold text-lg mb-1">{layout.name}</h3>
                <p className="text-xs text-muted-foreground mb-3">{layout.description}</p>

                {/* Layout Specs */}
                <div className="flex gap-2 text-xs text-muted-foreground mb-3">
                  {layout.sidebarWidth && (
                    <span className="flex items-center gap-1">
                      <i className="ki-filled ki-menu" />
                      {layout.sidebarWidth}
                    </span>
                  )}
                  {layout.headerHeight && (
                    <span className="flex items-center gap-1">
                      <i className="ki-filled ki-burger-menu-1" />
                      {layout.headerHeight}
                    </span>
                  )}
                </div>

                {/* Features */}
                <div className="flex flex-wrap gap-1">
                  {layout.features.slice(0, 3).map((feature) => (
                    <span
                      key={feature}
                      className="text-xs px-2 py-1 bg-muted rounded-md border border-border"
                    >
                      {feature}
                    </span>
                  ))}
                  {layout.features.length > 3 && (
                    <span className="text-xs px-2 py-1 text-muted-foreground">
                      +{layout.features.length - 3}
                    </span>
                  )}
                </div>
              </div>

              {/* Hover Effect */}
              <div className="absolute inset-0 rounded-lg bg-primary opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none" />
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground mb-2">Categorias:</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className={getCategoryColor('sidebar')}>
              Sidebar
            </Badge>
            <Badge variant="secondary" className={getCategoryColor('top-nav')}>
              Top Navigation
            </Badge>
            <Badge variant="secondary" className={getCategoryColor('hybrid')}>
              Hybrid
            </Badge>
            <Badge variant="secondary" className={getCategoryColor('compact')}>
              Compact
            </Badge>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
