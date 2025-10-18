import { UserMenu } from '@/components/layout/common/user-menu'
import { Notifications } from '@/components/layout/common/notifications'

export function Demo8Header() {
  return (
    <header className="h-16 border-b border-border bg-background flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <button className="lg:hidden p-2" data-kt-drawer-toggle="#demo8-sidebar">
          <i className="ki-filled ki-menu text-xl"></i>
        </button>
        <h2 className="text-lg font-semibold">Sidebar Accordion</h2>
      </div>
      <div className="flex items-center gap-2">
        <Notifications />
        <UserMenu />
      </div>
    </header>
  )
}
