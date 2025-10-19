import { Head } from '@inertiajs/react'
import { AuthCard } from '@/components/auth/auth-card'
import { RegisterForm } from '@/components/auth/register-form'

export default function Register() {
  return (
    <>
      <Head title="Criar Conta - JuridicAI" />
      <AuthCard
        title="Crie sua conta"
        description="Comece a gerenciar seus processos jurídicos com inteligência"
      >
        <RegisterForm />
      </AuthCard>
    </>
  )
}
