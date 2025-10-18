import { Logo } from '@/components/layout/common/logo'
import { UserMenu } from '@/components/layout/common/user-menu'
import { Notifications } from '@/components/layout/common/notifications'

export function Demo5Header() {
  return (
    <header className="border-b border-border bg-background">
      <div className="h-16 px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-accent rounded-md" data-kt-drawer-toggle="#demo5-drawer">
            <i className="ki-filled ki-menu text-xl"></i>
          </button>
          <Logo />
        </div>
        <div className="flex items-center gap-2">
          <Notifications />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
