import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Link } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/use-auth'
import { GoogleButton } from './google-button'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
})

type LoginFormData = z.infer<typeof loginSchema>

export function LoginForm() {
  const { signInWithEmailPassword, loading, error } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setFormError(null)
    await signInWithEmailPassword(data)
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Google Sign-In */}
      <GoogleButton className="w-full" />

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-white/40" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white/60 backdrop-blur-md px-3 py-1 rounded-full text-[#6E6E6E] font-medium">
            Ou continue com
          </span>
        </div>
      </div>

      {/* Email/Password Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 md:space-y-6">
        {/* Error Messages */}
        {(formError || error) && (
          <div className="rounded-[12px] bg-red-50 border border-red-200 p-3 text-sm text-red-600">
            {formError || error}
          </div>
        )}

        {/* Email Field */}
        <div className="space-y-2.5">
          <Label htmlFor="email" className="text-sm font-medium text-[#434343]">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="seuemail@exemplo.com"
            className="h-12 rounded-[12px] border border-white/40 bg-white/60 backdrop-blur-md shadow-sm focus:border-[#434343] focus:ring-[#434343]/20 focus:shadow-lg transition-all"
            {...register('email')}
            disabled={loading}
          />
          {errors.email && (
            <p className="text-sm text-red-600 flex items-center gap-2">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-medium text-[#434343]">
              Senha
            </Label>
            <Link
              href="/forgot-password"
              className="text-sm text-[#6E6E6E] hover:text-[#434343] transition-colors focus:outline-none focus:ring-2 focus:ring-[#434343] focus:ring-offset-2 rounded"
            >
              Esqueceu a senha?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            className="h-12 rounded-[12px] border border-white/40 bg-white/60 backdrop-blur-md shadow-sm focus:border-[#434343] focus:ring-[#434343]/20 focus:shadow-lg transition-all"
            {...register('password')}
            disabled={loading}
          />
          {errors.password && (
            <p className="text-sm text-red-600 flex items-center gap-2">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          size="lg"
          className="w-full rounded-[12px] bg-[#434343] hover:bg-[#6E6E6E] text-white transition-all shadow-lg shadow-[#434343]/20 hover:shadow-xl hover:shadow-[#434343]/30 hover:scale-[1.02]"
          disabled={loading}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>

      {/* Sign Up Link */}
      <div className="text-center text-sm">
        <span className="text-[#6E6E6E]">Não tem uma conta? </span>
        <Link
          href="/register"
          className="font-medium text-[#434343] hover:text-[#6E6E6E] transition-colors focus:outline-none focus:ring-2 focus:ring-[#434343] focus:ring-offset-2 rounded"
        >
          Criar conta
        </Link>
      </div>
    </div>
  )
}
