import * as React from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface AuthCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  children: React.ReactNode
}

export function AuthCard({ title, description, children, className, ...props }: AuthCardProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#EDEDED] via-[#F5F5F5] to-[#E8E8E8] p-4">
      {/* Enhanced Glass Background Effect */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Top left white blob */}
        <div className="absolute top-1/4 -left-20 h-[700px] w-[700px] rounded-full bg-white/40 blur-3xl animate-pulse" />

        {/* Bottom right dark blob */}
        <div
          className="absolute bottom-1/4 -right-20 h-[700px] w-[700px] rounded-full bg-[#434343]/10 blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        />

        {/* Center radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[800px] w-[800px] rounded-full bg-white/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo / Brand */}
        <div className="mb-10 text-center">
          <h1 className="text-5xl font-bold text-[#434343] drop-shadow-sm">JuridicAI</h1>
          <p className="mt-3 text-sm font-medium text-[#6E6E6E]">Gestão jurídica inteligente</p>
        </div>

        {/* Auth Card - Enhanced Liquid Glass Design */}
        <Card
          className={cn(
            'relative border-2 border-white/60 shadow-[0_20px_60px_rgba(0,0,0,0.15)] bg-white/80 backdrop-blur-3xl overflow-hidden',
            className
          )}
          {...props}
        >
          {/* Glow effect on border */}
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/40 via-transparent to-white/20 pointer-events-none" />

          {/* Content wrapper with unified padding */}
          <div className="relative z-10 p-6 md:p-10">
            {/* Header integrado */}
            <div className="space-y-3 mb-8">
              <h2 className="text-3xl font-bold text-[#434343]">{title}</h2>
              {description && <p className="text-base text-[#6E6E6E]">{description}</p>}
            </div>

            {/* Content */}
            {children}
          </div>
        </Card>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-[#6E6E6E]">© 2025 JuridicAI. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
  )
}
