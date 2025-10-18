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
    <footer className="border-t border-border bg-background">
      <div className="px-5 lg:px-7.5 py-5">
        <div className="flex flex-col md:flex-row justify-center md:justify-between items-center gap-3">
          {/* Copyright - Order 2 on mobile, 1 on desktop */}
          <div className="flex order-2 md:order-1 gap-2 text-sm font-normal">
            <span className="text-muted-foreground">{currentYear} &copy;</span>
            <span className="text-foreground font-medium">
              Juridic<span className="text-primary">AI</span>
            </span>
          </div>

          {/* Navigation Links - Order 1 on mobile, 2 on desktop */}
          <nav className="flex order-1 md:order-2 gap-4 text-sm font-normal">
            <Link
              href="/docs"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              Documentação
            </Link>
            <Link
              href="/support"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              Suporte
            </Link>
            <Link
              href="/terms"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              Termos
            </Link>
            <Link
              href="/privacy"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              Privacidade
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
