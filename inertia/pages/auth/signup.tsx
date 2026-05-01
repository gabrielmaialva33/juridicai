import { Head } from '@inertiajs/react'
import { Form, Link } from '@adonisjs/inertia/react'
import { ArrowRight, AtSign, KeyRound, User } from 'lucide-react'
import { AuthLayout } from '~/components/layouts/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Signup() {
  return (
    <>
      <Head title="Cadastrar" />
      <AuthLayout title="Criar nova conta" subtitle="Cadastre-se para iniciar a operação no radar.">
        <Form route="auth.signup.store" className="space-y-5">
          {({ errors, processing }) => (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-xs font-medium uppercase tracking-wider">
                  Nome completo
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    placeholder="Seu nome completo"
                    className="pl-9"
                    aria-invalid={!!errors.fullName}
                  />
                </div>
                {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
              </div>

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
                    autoComplete="email"
                    placeholder="voce@exemplo.com.br"
                    className="pl-9"
                    aria-invalid={!!errors.email}
                  />
                </div>
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider">
                  Senha
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    className="pl-9"
                    aria-invalid={!!errors.password}
                  />
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="passwordConfirmation"
                  className="text-xs font-medium uppercase tracking-wider"
                >
                  Confirmar senha
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="passwordConfirmation"
                    name="passwordConfirmation"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="pl-9"
                    aria-invalid={!!errors.passwordConfirmation}
                  />
                </div>
                {errors.passwordConfirmation && (
                  <p className="text-xs text-destructive">{errors.passwordConfirmation}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={processing}>
                {processing ? 'Criando...' : 'Criar conta'}
                {!processing && <ArrowRight className="ms-1 size-4" />}
              </Button>

              <p className="text-xs text-muted-foreground text-center pt-4 border-t border-border">
                Já tem conta?{' '}
                <Link
                  href="/login"
                  className="text-foreground font-medium hover:underline underline-offset-4"
                >
                  Entrar
                </Link>
              </p>
            </>
          )}
        </Form>
      </AuthLayout>
    </>
  )
}
