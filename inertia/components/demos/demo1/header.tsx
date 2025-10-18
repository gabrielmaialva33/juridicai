import { UserMenu } from '@/components/layout/common/user-menu'
import { Notifications } from '@/components/layout/common/notifications'

export function Demo1Header() {
  return (
    <header className="h-16 border-b border-border bg-background flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">Demo 1</h2>
      </div>
      <div className="flex items-center gap-2">
        <Notifications />
        <UserMenu />
      </div>
    </header>
  )
}
