import { useEffect, useState } from 'react'
import { Building2, Menu } from 'lucide-react'
import { Link, usePage } from '@inertiajs/react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { useScrollPosition } from '@/hooks/use-scroll-position'
import { Button } from '@/components/ui/button'
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTrigger } from '@/components/ui/sheet'
import { SidebarMenu } from './sidebar-menu'
import { SidebarHeader } from './sidebar-header'

interface Props {
  sidebarWidth?: number
  headerHeight?: number
  tenantName?: string | null
}

export function Header({ sidebarWidth = 0, headerHeight = 64, tenantName }: Props) {
  const [isSidebarSheetOpen, setIsSidebarSheetOpen] = useState(false)
  const { url } = usePage()
  const mobileMode = useIsMobile()
  const scrollPosition = useScrollPosition()
  const headerSticky: boolean = scrollPosition > 0

  useEffect(() => {
    setIsSidebarSheetOpen(false)
  }, [url])

  return (
    <header
      className={cn(
        'fixed top-0 z-10 flex items-stretch shrink-0 border-b border-transparent bg-background end-0 transition-[inset-inline-start] duration-300 ease-in-out',
        headerSticky && 'border-b border-border shadow-xs'
      )}
      style={{ insetInlineStart: sidebarWidth, height: headerHeight }}
    >
      <div className="w-full flex items-stretch justify-between px-4 lg:px-6 lg:gap-4">
        {/* Mobile: hamburger + logo */}
        <div className="flex lg:hidden items-center gap-2">
          {mobileMode && (
            <Sheet open={isSidebarSheetOpen} onOpenChange={setIsSidebarSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" mode="icon">
                  <Menu className="text-muted-foreground" />
                </Button>
              </SheetTrigger>
              <SheetContent className="p-0 gap-0 w-[280px]" side="left" close={false}>
                <SheetHeader className="p-0 space-y-0">
                  <SidebarHeader isExpanded />
                </SheetHeader>
                <SheetBody className="p-0 overflow-y-auto">
                  <SidebarMenu isExpanded />
                </SheetBody>
              </SheetContent>
            </Sheet>
          )}
          <Link href="/dashboard" className="text-sm font-semibold">
            JuridicAI
          </Link>
        </div>

        {/* Desktop: tenant indicator */}
        {!mobileMode && tenantName && (
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="size-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">{tenantName}</span>
          </div>
        )}

        <div className="flex items-center gap-1 ms-auto" />
      </div>
    </header>
  )
}
