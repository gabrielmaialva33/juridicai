import { ReactNode } from 'react'
import { Scale } from 'lucide-react'

interface Props {
  children: ReactNode
  title?: string
  subtitle?: string
}

export function AuthLayout({ children, title, subtitle }: Props) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left: form */}
      <div className="flex flex-col justify-center px-6 py-12 lg:px-12">
        <div className="mx-auto w-full max-w-sm space-y-8">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-9 rounded-md bg-primary text-primary-foreground">
              <Scale className="size-5" />
            </div>
            <span className="text-base font-semibold tracking-tight">JuridicAI</span>
          </div>

          {title && (
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          )}

          {children}
        </div>
      </div>

      {/* Right: brand panel (desktop only) */}
      <div className="hidden lg:flex relative bg-muted/40 border-s border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-violet-500/10" />
        <div className="relative z-10 flex flex-col justify-end p-12 w-full">
          <blockquote className="space-y-3 max-w-md">
            <p className="text-lg font-medium tracking-tight text-foreground">
              "Não vendemos lista de pessoas. Qualificamos ativos judiciais com dados públicos e
              governança comercial."
            </p>
            <footer className="text-sm text-muted-foreground">
              — Sistema de Originação e Qualificação de Precatórios
            </footer>
          </blockquote>
        </div>
      </div>
    </div>
  )
}
