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
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#EDEDED] p-4">
        {/* Subtle Glass Background Effect */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -left-20 h-[600px] w-[600px] rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-1/4 -right-20 h-[600px] w-[600px] rounded-full bg-[#434343]/5 blur-3xl" />
        </div>

        <div className="relative w-full max-w-2xl">
          {/* Logo */}
          <div className="mb-8 text-center">
            <h1 className="text-5xl font-bold text-[#434343] drop-shadow-sm">JuridicAI</h1>
            <p className="mt-2 text-sm font-medium text-[#6E6E6E]">Configure seu escritório</p>
          </div>

          {/* Progress Steps - Liquid Glass Style */}
          <div className="mb-8">
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
                <div key={s} className="flex items-center">
                  <div
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-[16px] text-sm font-bold transition-all duration-300',
                      step >= s
                        ? 'bg-[#434343] text-white shadow-xl shadow-[#434343]/20 backdrop-blur-xl scale-105'
                        : 'bg-white/80 backdrop-blur-md border-2 border-white/40 text-[#6E6E6E] shadow-lg'
                    )}
                  >
                    {s}
                  </div>
                  {s < totalSteps && (
                    <div
                      className={cn(
                        'h-1 w-20 rounded-full transition-all duration-500',
                        step > s ? 'bg-[#434343] shadow-md' : 'bg-white/60 backdrop-blur-sm'
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Onboarding Card - Liquid Glass Design */}
          <Card className="border border-white/40 shadow-2xl bg-white/95 backdrop-blur-2xl">
            <form onSubmit={handleSubmit(onSubmit)}>
              {/* Step 1: Welcome */}
              {step === 1 && (
                <>
                  <CardHeader className="space-y-3">
                    <CardTitle className="text-3xl font-bold text-[#434343]">
                      Bem-vindo ao JuridicAI
                    </CardTitle>
                    <CardDescription className="text-base text-[#6E6E6E]">
                      Vamos configurar seu perfil em apenas alguns passos
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Info Card - Liquid Glass Effect */}
                    <div className="rounded-[20px] bg-white/60 backdrop-blur-xl border border-white/40 p-6 shadow-lg">
                      <p className="font-bold text-[#434343] mb-4">O que você vai configurar:</p>
                      <ul className="space-y-3 text-[#434343]">
                        <li className="flex items-start gap-3">
                          <div className="mt-1.5 h-2 w-2 rounded-full bg-[#434343] shadow-sm" />
                          <span>Informações do seu escritório</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="mt-1.5 h-2 w-2 rounded-full bg-[#434343] shadow-sm" />
                          <span>Áreas de atuação</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="mt-1.5 h-2 w-2 rounded-full bg-[#434343] shadow-sm" />
                          <span>Preferências iniciais</span>
                        </li>
                      </ul>
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button
                        type="button"
                        onClick={() => setStep(2)}
                        size="lg"
                        className="rounded-[12px] bg-[#434343] hover:bg-[#6E6E6E] text-white transition-all shadow-lg shadow-[#434343]/20 hover:shadow-xl hover:shadow-[#434343]/30 hover:scale-[1.02]"
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
                    <CardTitle className="text-3xl font-bold text-[#434343]">
                      Dados do Escritório
                    </CardTitle>
                    <CardDescription className="text-base text-[#6E6E6E]">
                      Informe os dados básicos do seu escritório
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-5">
                      <div className="space-y-2.5">
                        <Label htmlFor="firmName" className="text-sm font-medium text-[#434343]">
                          Nome do Escritório <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="firmName"
                          placeholder="Escritório de Advocacia Silva & Associados"
                          className="h-12 rounded-[12px] border border-white/40 bg-white/60 backdrop-blur-md shadow-sm focus:border-[#434343] focus:ring-[#434343]/20 focus:shadow-lg transition-all"
                          {...register('firmName')}
                        />
                        {errors.firmName && (
                          <p className="text-sm text-destructive flex items-center gap-2">
                            {errors.firmName.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2.5">
                        <Label htmlFor="oabNumber" className="text-sm font-medium text-[#434343]">
                          Número OAB (opcional)
                        </Label>
                        <Input
                          id="oabNumber"
                          placeholder="SP 123.456"
                          className="h-12 rounded-[12px] border border-white/40 bg-white/60 backdrop-blur-md shadow-sm focus:border-[#434343] focus:ring-[#434343]/20 focus:shadow-lg transition-all"
                          {...register('oabNumber')}
                        />
                      </div>

                      <div className="space-y-2.5">
                        <Label htmlFor="phone" className="text-sm font-medium text-[#434343]">
                          Telefone (opcional)
                        </Label>
                        <Input
                          id="phone"
                          placeholder="(11) 98765-4321"
                          className="h-12 rounded-[12px] border border-white/40 bg-white/60 backdrop-blur-md shadow-sm focus:border-[#434343] focus:ring-[#434343]/20 focus:shadow-lg transition-all"
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
                        className="rounded-[12px] border border-white/40 bg-white/60 backdrop-blur-md hover:border-[#434343] hover:bg-white/80 text-[#434343] transition-all shadow-sm hover:shadow-md hover:scale-[1.01]"
                      >
                        Voltar
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setStep(3)}
                        size="lg"
                        className="rounded-[12px] bg-[#434343] hover:bg-[#6E6E6E] text-white transition-all shadow-lg shadow-[#434343]/20 hover:shadow-xl hover:shadow-[#434343]/30 hover:scale-[1.02]"
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
                    <CardTitle className="text-3xl font-bold text-[#434343]">
                      Áreas de Atuação
                    </CardTitle>
                    <CardDescription className="text-base text-[#6E6E6E]">
                      Selecione as áreas em que seu escritório atua
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-3">
                      {PRACTICE_AREAS.map((area) => {
                        const isSelected = selectedAreas.includes(area)
                        return (
                          <button
                            key={area}
                            type="button"
                            onClick={() => toggleArea(area)}
                            className={cn(
                              'group relative overflow-hidden rounded-[16px] p-4 text-left transition-all duration-300',
                              'border-2 backdrop-blur-md',
                              isSelected
                                ? 'border-[#434343] bg-white/90 shadow-xl shadow-[#434343]/10 scale-[1.03]'
                                : 'border-white/40 bg-white/50 hover:border-[#6E6E6E] hover:bg-white/70 hover:shadow-lg hover:scale-[1.01]'
                            )}
                          >
                            {/* Liquid Glass Shine Effect on Hover */}
                            <div
                              className={cn(
                                'absolute inset-0 bg-gradient-to-br from-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500',
                                isSelected && 'opacity-50'
                              )}
                            />

                            <div className="relative flex items-center justify-between">
                              <span
                                className={cn(
                                  'font-semibold transition-colors',
                                  isSelected ? 'text-[#434343]' : 'text-[#6E6E6E]'
                                )}
                              >
                                {area}
                              </span>
                              {isSelected && (
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#434343] shadow-lg">
                                  <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
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
                        className="rounded-[12px] border-[#EDEDED] hover:border-[#434343] hover:bg-[#EDEDED] text-[#434343] transition-all"
                      >
                        Voltar
                      </Button>
                      <Button
                        type="submit"
                        size="lg"
                        className="rounded-[12px] bg-[#434343] hover:bg-[#6E6E6E] text-white transition-colors"
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
            <p className="text-xs text-[#6E6E6E]">
              Você pode alterar essas configurações depois nas configurações do seu perfil
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
