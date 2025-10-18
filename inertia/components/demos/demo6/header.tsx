import { Menu, Search } from 'lucide-react'
import { Logo } from '@/components/layout/common/logo'
import { UserMenu } from '@/components/layout/common/user-menu'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Demo6Sidebar } from './sidebar'
import { useTypedPage } from '@/hooks/use_typed_page'

export function Demo6Header() {
  const { props } = useTypedPage()
  const user = props.auth?.user

  return (
    <header className="lg:hidden sticky top-0 z-30 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-[60px] items-center justify-between px-4">
        {/* Left: Mobile Menu Trigger */}
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[270px] p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation Menu</SheetTitle>
              </SheetHeader>
              <Demo6Sidebar currentPath={props.currentPath || '/dashboard'} />
            </SheetContent>
          </Sheet>

          <Logo size="sm" showText={true} />
        </div>

        {/* Right: Search & User Menu */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Search className="h-5 w-5" />
            <span className="sr-only">Search</span>
          </Button>
          <UserMenu userName={user?.name} userEmail={user?.email} />
        </div>
      </div>
    </header>
  )
}
