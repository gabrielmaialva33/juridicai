import { Head } from '@inertiajs/react'
import { Form, Link } from '@adonisjs/inertia/react'
import { ArrowRight, AtSign, KeyRound } from 'lucide-react'
import { AuthLayout } from '~/components/layouts/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Login() {
  return (
    <>
      <Head title="Entrar" />
      <AuthLayout title="Entre na sua conta" subtitle="Acesse o radar de precatórios federais.">
        <Form route="auth.login.store" className="space-y-5">
          {({ errors, processing }) => (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider">
                  Email
                </Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    placeholder="voce@exemplo.com.br"
                    className="pl-9"
                    aria-invalid={!!errors.email}
                  />
                </div>
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="password"
                    className="text-xs font-medium uppercase tracking-wider"
                  >
                    Senha
                  </Label>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="pl-9"
                    aria-invalid={!!errors.password}
                  />
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={processing}>
                {processing ? 'Entrando...' : 'Entrar'}
                {!processing && <ArrowRight className="ms-1 size-4" />}
              </Button>

              <p className="text-xs text-muted-foreground text-center pt-4 border-t border-border">
                Não tem conta?{' '}
                <Link
                  href="/signup"
                  className="text-foreground font-medium hover:underline underline-offset-4"
                >
                  Cadastre-se
                </Link>
              </p>
            </>
          )}
        </Form>
      </AuthLayout>
    </>
  )
}
