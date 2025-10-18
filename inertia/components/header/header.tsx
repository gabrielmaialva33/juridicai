import { usePage } from '@inertiajs/react'
import { Bell, Search, ChevronDown, Menu, LogOut, Settings, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface HeaderProps {
  onToggleSidebar: () => void
  onToggleMobileSidebar: () => void
}

export function Header({ onToggleSidebar, onToggleMobileSidebar }: HeaderProps) {
  const { props } = usePage()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [tenantMenuOpen, setTenantMenuOpen] = useState(false)

  // Type assertion for shared props (will be configured in FASE 3)
  const user = (props as any).user || { name: 'User', email: 'user@example.com' }
  const tenant = (props as any).tenant || { name: 'Organização' }

  return (
    <header className="flex items-center justify-between h-16 px-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {/* Mobile Menu Button */}
        <button
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Toggle mobile menu"
        >
          <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>

        {/* Desktop Sidebar Toggle */}
        <button
          onClick={onToggleSidebar}
          className="hidden lg:block p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>

        {/* Tenant Switcher */}
        <div className="relative">
          <button
            onClick={() => setTenantMenuOpen(!tenantMenuOpen)}
            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {tenant.name}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>

          {/* Tenant Dropdown Menu - Will be implemented in FASE 3 */}
          {tenantMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
              <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                Selecione uma organização
              </div>
              <div className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {tenant.name}
                </p>
                <p className="text-xs text-gray-500">Atual</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Search Button */}
        <button
          className="hidden md:flex p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Search"
        >
          <Search className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>

        {/* Notifications Button */}
        <button
          className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="hidden sm:block text-sm text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
              {user.name}
            </span>
            <ChevronDown className="hidden sm:block w-4 h-4 text-gray-500" />
          </button>

          {/* User Dropdown Menu */}
          {userMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {user.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user.email}
                </p>
              </div>

              <a
                href="/profile"
                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <User className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-700 dark:text-gray-200">Perfil</span>
              </a>

              <a
                href="/settings"
                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Settings className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-700 dark:text-gray-200">Configurações</span>
              </a>

              <hr className="my-2 border-gray-200 dark:border-gray-700" />

              <a
                href="/logout"
                className="flex items-center gap-3 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Sair</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
