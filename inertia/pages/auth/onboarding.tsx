import { useState } from 'react'
import { Head, router } from '@inertiajs/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

const onboardingSchema = z.object({
  firmName: z.string().min(3, 'Nome do escritório deve ter no mínimo 3 caracteres'),
  oabNumber: z.string().optional(),
  phone: z.string().optional(),
  practiceAreas: z.array(z.string()).min(1, 'Selecione ao menos uma área de atuação'),
})

type OnboardingFormData = z.infer<typeof onboardingSchema>

const PRACTICE_AREAS = [
  'Civil',
  'Criminal',
  'Trabalhista',
  'Família',
  'Tributário',
  'Administrativo',
  'Previdenciário',
  'Empresarial',
  'Imobiliário',
  'Consumidor',
]

export default function Onboarding() {
  const [step, setStep] = useState(1)
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      practiceAreas: [],
    },
  })

  const toggleArea = (area: string) => {
    const newAreas = selectedAreas.includes(area)
      ? selectedAreas.filter((a) => a !== area)
      : [...selectedAreas, area]
    setSelectedAreas(newAreas)
    setValue('practiceAreas', newAreas)
  }

  const onSubmit = async (data: OnboardingFormData) => {
    // Send onboarding data to backend
    // For now, just redirect to dashboard
    router.visit('/dashboard')
  }

  const totalSteps = 3

  return (
    <>
      <Head title="Configuração Inicial - JuridicAI" />
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50 via-purple-50/30 to-pink-50/20 dark:from-slate-950 dark:via-blue-950/30 dark:to-purple-950/20 p-4">
        {/* Animated Background Blobs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-gradient-to-br from-blue-400/20 to-purple-400/20 blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-gradient-to-br from-pink-400/20 to-orange-400/20 blur-3xl animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-gradient-to-br from-purple-400/10 to-blue-400/10 blur-3xl animate-pulse delay-500" />
        </div>

        <div className="relative w-full max-w-2xl">
          {/* Logo */}
          <div className="mb-8 text-center">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-gradient">
              JuridicAI
            </h1>
            <p className="mt-2 text-sm font-medium bg-gradient-to-r from-blue-600/80 to-purple-600/80 bg-clip-text text-transparent">
              Configure seu escritório
            </p>
          </div>

          {/* Progress Steps - Colorful Glass Style */}
          <div className="mb-8">
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => {
                const colors = [
                  'from-blue-500 via-blue-600 to-blue-700 shadow-blue-500/30',
                  'from-purple-500 via-purple-600 to-purple-700 shadow-purple-500/30',
                  'from-pink-500 via-pink-600 to-pink-700 shadow-pink-500/30',
                ]
                return (
                  <div key={s} className="flex items-center">
                    <div
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-[16px] text-sm font-bold transition-all duration-500',
                        step >= s
                          ? `bg-gradient-to-br ${colors[s - 1]} text-white shadow-2xl backdrop-blur-xl border border-white/30 scale-110 animate-bounce-subtle`
                          : 'bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-slate-300/30 dark:border-slate-600/30 text-slate-600 dark:text-slate-400 shadow-lg'
                      )}
                    >
                      {s}
                    </div>
                    {s < totalSteps && (
                      <div
                        className={cn(
                          'h-1.5 w-20 rounded-full transition-all duration-700',
                          step > s
                            ? `bg-gradient-to-r ${colors[s - 1]} shadow-lg`
                            : 'bg-slate-300/40 dark:bg-slate-700/40'
                        )}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Onboarding Card - Colorful Premium Glass Effect */}
          <Card className="border-white/20 dark:border-slate-700/30 shadow-2xl shadow-purple-500/5 backdrop-blur-2xl bg-white/90 dark:bg-slate-900/90 hover:shadow-purple-500/10 transition-all duration-300">
            <form onSubmit={handleSubmit(onSubmit)}>
              {/* Step 1: Welcome */}
              {step === 1 && (
                <>
                  <CardHeader className="space-y-3">
                    <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                      Bem-vindo ao JuridicAI
                    </CardTitle>
                    <CardDescription className="text-base text-slate-600 dark:text-slate-400">
                      Vamos configurar seu perfil em apenas alguns passos
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Info Card - Colorful Liquid Glass Effect */}
                    <div className="rounded-[20px] bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-pink-500/10 backdrop-blur-xl border border-purple-300/30 dark:border-purple-500/20 p-6 shadow-xl shadow-purple-500/10">
                      <p className="font-bold text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text mb-4">
                        O que você vai configurar:
                      </p>
                      <ul className="space-y-3 text-slate-700 dark:text-slate-300">
                        <li className="flex items-start gap-3">
                          <div className="mt-1.5 h-2 w-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 shadow-lg shadow-blue-500/50" />
                          <span>Informações do seu escritório</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="mt-1.5 h-2 w-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg shadow-purple-500/50" />
                          <span>Áreas de atuação</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="mt-1.5 h-2 w-2 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 shadow-lg shadow-pink-500/50" />
                          <span>Preferências iniciais</span>
                        </li>
                      </ul>
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button
                        type="button"
                        onClick={() => setStep(2)}
                        size="lg"
                        className="rounded-[12px] bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-[1.02] transition-all duration-300"
                      >
                        Começar
                      </Button>
                    </div>
                  </CardContent>
                </>
              )}

              {/* Step 2: Firm Details */}
              {step === 2 && (
                <>
                  <CardHeader className="space-y-3">
                    <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 bg-clip-text text-transparent">
                      Dados do Escritório
                    </CardTitle>
                    <CardDescription className="text-base text-slate-600 dark:text-slate-400">
                      Informe os dados básicos do seu escritório
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-5">
                      <div className="space-y-2.5">
                        <Label htmlFor="firmName" className="text-sm font-medium">
                          Nome do Escritório <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="firmName"
                          placeholder="Escritório de Advocacia Silva & Associados"
                          className="h-12 rounded-[12px] border-purple-200/50 dark:border-purple-500/30 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm focus:border-purple-500/50 focus:ring-purple-500/20 transition-all"
                          {...register('firmName')}
                        />
                        {errors.firmName && (
                          <p className="text-sm text-destructive flex items-center gap-2">
                            {errors.firmName.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2.5">
                        <Label htmlFor="oabNumber" className="text-sm font-medium">
                          Número OAB (opcional)
                        </Label>
                        <Input
                          id="oabNumber"
                          placeholder="SP 123.456"
                          className="h-12 rounded-[12px] border-purple-200/50 dark:border-purple-500/30 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm focus:border-purple-500/50 focus:ring-purple-500/20 transition-all"
                          {...register('oabNumber')}
                        />
                      </div>

                      <div className="space-y-2.5">
                        <Label htmlFor="phone" className="text-sm font-medium">
                          Telefone (opcional)
                        </Label>
                        <Input
                          id="phone"
                          placeholder="(11) 98765-4321"
                          className="h-12 rounded-[12px] border-purple-200/50 dark:border-purple-500/30 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm focus:border-purple-500/50 focus:ring-purple-500/20 transition-all"
                          {...register('phone')}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep(1)}
                        size="lg"
                        className="rounded-[12px] border-purple-200 dark:border-purple-500/30 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-all"
                      >
                        Voltar
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setStep(3)}
                        size="lg"
                        className="rounded-[12px] bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-pink-500/40 hover:scale-[1.02] transition-all duration-300"
                      >
                        Próximo
                      </Button>
                    </div>
                  </CardContent>
                </>
              )}

              {/* Step 3: Practice Areas */}
              {step === 3 && (
                <>
                  <CardHeader className="space-y-3">
                    <CardTitle className="text-3xl font-bold bg-gradient-to-r from-pink-600 via-orange-600 to-yellow-600 bg-clip-text text-transparent">
                      Áreas de Atuação
                    </CardTitle>
                    <CardDescription className="text-base text-slate-600 dark:text-slate-400">
                      Selecione as áreas em que seu escritório atua
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-3">
                      {PRACTICE_AREAS.map((area, index) => {
                        const isSelected = selectedAreas.includes(area)
                        const gradients = [
                          'from-blue-500 to-cyan-500',
                          'from-purple-500 to-pink-500',
                          'from-pink-500 to-rose-500',
                          'from-orange-500 to-amber-500',
                          'from-green-500 to-emerald-500',
                          'from-indigo-500 to-purple-500',
                          'from-teal-500 to-cyan-500',
                          'from-violet-500 to-fuchsia-500',
                          'from-sky-500 to-blue-500',
                          'from-amber-500 to-yellow-500',
                        ]
                        const gradient = gradients[index % gradients.length]
                        return (
                          <button
                            key={area}
                            type="button"
                            onClick={() => toggleArea(area)}
                            className={cn(
                              'group relative overflow-hidden rounded-[16px] p-4 text-left transition-all duration-300',
                              'border-2 backdrop-blur-sm',
                              isSelected
                                ? `border-transparent bg-gradient-to-br ${gradient} shadow-2xl shadow-${gradient.split(' ')[0].replace('from-', '').replace('-500', '-500/40')} scale-[1.03]`
                                : 'border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-800/40 hover:border-purple-300 dark:hover:border-purple-500/30 hover:bg-purple-50/50 dark:hover:bg-purple-500/10 hover:scale-[1.01] hover:shadow-lg'
                            )}
                          >
                            {/* Liquid Glass Shine Effect */}
                            <div
                              className={cn(
                                'absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500',
                                isSelected && 'opacity-60'
                              )}
                            />

                            <div className="relative flex items-center justify-between">
                              <span
                                className={cn(
                                  'font-semibold transition-colors',
                                  isSelected
                                    ? 'text-white drop-shadow-lg'
                                    : 'text-slate-700 dark:text-slate-300'
                                )}
                              >
                                {area}
                              </span>
                              {isSelected && (
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/30 backdrop-blur-sm border border-white/50 shadow-lg">
                                  <Check className="h-3.5 w-3.5 text-white drop-shadow-md" strokeWidth={3} />
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {errors.practiceAreas && (
                      <p className="text-sm text-destructive flex items-center gap-2">
                        {errors.practiceAreas.message}
                      </p>
                    )}

                    <div className="flex justify-between gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep(2)}
                        size="lg"
                        className="rounded-[12px] border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all"
                      >
                        Voltar
                      </Button>
                      <Button
                        type="submit"
                        size="lg"
                        className="rounded-[12px] shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                      >
                        Concluir Configuração
                      </Button>
                    </div>
                  </CardContent>
                </>
              )}
            </form>
          </Card>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-xs text-muted-foreground">
              Você pode alterar essas configurações depois nas configurações do seu perfil
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
