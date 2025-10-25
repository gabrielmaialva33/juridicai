import { Head } from '@inertiajs/react'
import { AuthCard } from '@/components/auth/auth-card'
import { LoginForm } from '@/components/auth/login-form'

export default function Login() {
  return (
    <>
      <Head title="Login - JuridicAI" />
      <AuthCard title="Bem-vindo de volta" description="Entre na sua conta para continuar">
        <LoginForm />
      </AuthCard>
    </>
  )
}
