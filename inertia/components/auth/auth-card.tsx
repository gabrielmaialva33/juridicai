import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface AuthCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  children: React.ReactNode
}

export function AuthCard({ title, description, children, className, ...props }: AuthCardProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            JuridicAI
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gestão jurídica inteligente
          </p>
        </div>

        {/* Auth Card */}
        <Card
          className={cn(
            'border-border/50 shadow-2xl backdrop-blur-sm bg-card/95',
            'hover:shadow-primary/5 transition-shadow duration-300',
            className
          )}
          {...props}
        >
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">{title}</CardTitle>
            {description && <CardDescription className="text-base">{description}</CardDescription>}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            © 2025 JuridicAI. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  )
}
