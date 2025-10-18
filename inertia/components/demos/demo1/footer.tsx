import { Link } from '@inertiajs/react'

/**
 * Demo1 Footer Component
 *
 * Responsive footer with:
 * - Copyright information
 * - Navigation links
 * - Mobile-first responsive layout
 * - Professional Metronic styling
 */
export function Demo1Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-background mt-auto">
      <div className="px-4 sm:px-5 lg:px-7.5 py-4 sm:py-5">
        <div className="flex flex-col sm:flex-row justify-center sm:justify-between items-center gap-3 sm:gap-4">
          {/* Copyright - Order 2 on mobile, 1 on desktop */}
          <div className="flex order-2 sm:order-1 gap-2 text-xs sm:text-sm font-normal">
            <span className="text-muted-foreground">{currentYear} &copy;</span>
            <span className="text-foreground font-medium">
              Juridic<span className="text-primary">AI</span>
            </span>
          </div>

          {/* Navigation Links - Order 1 on mobile, 2 on desktop */}
          <nav className="flex flex-wrap justify-center order-1 sm:order-2 gap-3 sm:gap-4 text-xs sm:text-sm font-normal">
            <Link
              href="/docs"
              className="text-muted-foreground hover:text-primary transition-colors whitespace-nowrap"
            >
              Documentação
            </Link>
            <Link
              href="/support"
              className="text-muted-foreground hover:text-primary transition-colors whitespace-nowrap"
            >
              Suporte
            </Link>
            <Link
              href="/terms"
              className="text-muted-foreground hover:text-primary transition-colors whitespace-nowrap"
            >
              Termos
            </Link>
            <Link
              href="/privacy"
              className="text-muted-foreground hover:text-primary transition-colors whitespace-nowrap"
            >
              Privacidade
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
