import { Link } from '@inertiajs/react'

export function Demo6Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-background">
      <div className="px-5 lg:px-7.5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <span>© {currentYear}</span>
            <Link href="/" className="font-medium text-foreground hover:underline">
              JuridicAI
            </Link>
            <span>- Sistema de Gestão Jurídica</span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacidade
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Termos de Uso
            </Link>
            <Link href="/support" className="hover:text-foreground transition-colors">
              Suporte
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
