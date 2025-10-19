import { useState } from 'react'
import { Head, router } from '@inertiajs/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import preferencesIllustration from '@/assets/images/undraw_preferences-popup_cru5.svg'
import remoteWorkerIllustration from '@/assets/images/undraw_remote-worker_0l91.svg'

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

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const onSubmit = async (data: OnboardingFormData) => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const response = await fetch('/api/v1/user/onboarding/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.errors?.[0]?.message || 'Falha ao salvar configurações')
      }

      // Success - redirect to dashboard
      router.visit('/dashboard')
    } catch (error: any) {
      console.error('Onboarding error:', error)
      setSubmitError(error.message || 'Erro ao salvar configurações. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalSteps = 3

  return (
    <>
      <Head title="Configuração Inicial - JuridicAI" />
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#EDEDED] via-[#F5F5F5] to-[#E8E8E8] p-4">
        {/* Enhanced Glass Background Effect */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Top left white blob - more visible */}
          <div className="absolute top-1/4 -left-20 h-[700px] w-[700px] rounded-full bg-white/40 blur-3xl animate-pulse" />

          {/* Bottom right dark blob - more visible */}
          <div className="absolute bottom-1/4 -right-20 h-[700px] w-[700px] rounded-full bg-[#434343]/10 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

          {/* Center radial glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[800px] w-[800px] rounded-full bg-white/20 blur-3xl" />
        </div>

        <div className="relative w-full max-w-2xl">
          {/* Logo */}
          <div className="mb-10 text-center">
            <h1 className="text-5xl font-bold text-[#434343] drop-shadow-sm">JuridicAI</h1>
            <p className="mt-3 text-sm font-medium text-[#6E6E6E]">Configure seu escritório</p>
          </div>

          {/* Onboarding Card - Enhanced Liquid Glass Design */}
          <Card className="relative border-2 border-white/60 shadow-[0_20px_60px_rgba(0,0,0,0.15)] bg-white/80 backdrop-blur-3xl overflow-hidden">
            {/* Glow effect on border */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/40 via-transparent to-white/20 pointer-events-none" />

            {/* Content wrapper with unified padding */}
            <div className="relative z-10 p-6 md:p-10">
            <form onSubmit={handleSubmit(onSubmit)}>
              {/* Step 1: Welcome */}
              {step === 1 && (
                <div className="space-y-6 md:space-y-8">
                  {/* Header integrado */}
                  <div className="space-y-3 text-center">
                    <h2 className="text-3xl font-bold text-[#434343]">
                      Bem-vindo ao JuridicAI
                    </h2>
                    <p className="text-base text-[#6E6E6E]">
                      Vamos configurar seu perfil em apenas alguns passos
                    </p>
                  </div>

                  {/* Content with Illustrations */}
                  <div className="space-y-6 md:space-y-8">
                    {/* Main Content Grid - Illustration + Info */}
                    <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-center">
                      {/* Left Side - Text Content */}
                      <div className="order-2 md:order-1">
                        <p className="font-bold text-[#434343] mb-6">O que você vai configurar:</p>
                        <ul className="space-y-4 text-[#434343]">
                          <li className="flex items-start gap-4">
                            <div className="mt-1.5 h-2 w-2 rounded-full bg-[#434343] shadow-sm flex-shrink-0" />
                            <span>Informações do seu escritório</span>
                          </li>
                          <li className="flex items-start gap-4">
                            <div className="mt-1.5 h-2 w-2 rounded-full bg-[#434343] shadow-sm flex-shrink-0" />
                            <span>Áreas de atuação</span>
                          </li>
                          <li className="flex items-start gap-4">
                            <div className="mt-1.5 h-2 w-2 rounded-full bg-[#434343] shadow-sm flex-shrink-0" />
                            <span>Preferências iniciais</span>
                          </li>
                        </ul>
                      </div>

                      {/* Right Side - Illustration */}
                      <div className="order-1 md:order-2 flex justify-center">
                        <img
                          src={preferencesIllustration}
                          alt="Configurações"
                          className="w-full max-w-[180px] md:max-w-[280px] h-auto opacity-90 drop-shadow-lg"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        type="button"
                        onClick={() => setStep(2)}
                        size="lg"
                        className="rounded-[12px] bg-[#434343] hover:bg-[#6E6E6E] text-white transition-all shadow-lg shadow-[#434343]/20 hover:shadow-xl hover:shadow-[#434343]/30 hover:scale-[1.02]"
                      >
                        Começar
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Firm Details */}
              {step === 2 && (
                <div className="space-y-6 md:space-y-8">
                  {/* Header integrado */}
                  <div className="space-y-3">
                    <h2 className="text-3xl font-bold text-[#434343]">
                      Dados do Escritório
                    </h2>
                    <p className="text-base text-[#6E6E6E]">
                      Informe os dados básicos do seu escritório
                    </p>
                  </div>

                  {/* Content */}
                  <div className="space-y-6 md:space-y-8">
                    <div className="space-y-5 md:space-y-6">
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
                        className="rounded-[12px] border-2 border-white/60 bg-white/70 backdrop-blur-xl hover:border-[#434343] hover:bg-white/90 text-[#434343] transition-all shadow-lg shadow-black/5 hover:shadow-xl hover:shadow-[#434343]/10 hover:scale-[1.02]"
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
                  </div>
                </div>
              )}

              {/* Step 3: Practice Areas */}
              {step === 3 && (
                <div className="space-y-6 md:space-y-8">
                  {/* Header integrado */}
                  <div className="space-y-3">
                    <h2 className="text-3xl font-bold text-[#434343]">
                      Áreas de Atuação
                    </h2>
                    <p className="text-base text-[#6E6E6E]">
                      Selecione as áreas em que seu escritório atua
                    </p>
                  </div>

                  {/* Content */}
                  <div className="space-y-6 md:space-y-8">
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                      {PRACTICE_AREAS.map((area) => {
                        const isSelected = selectedAreas.includes(area)
                        return (
                          <button
                            key={area}
                            type="button"
                            onClick={() => toggleArea(area)}
                            className={cn(
                              'group relative overflow-hidden rounded-[16px] p-3 md:p-4 text-left transition-all duration-300',
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

                    {submitError && (
                      <div className="rounded-[12px] bg-destructive/10 border border-destructive/20 p-4 backdrop-blur-md">
                        <p className="text-sm text-destructive">{submitError}</p>
                      </div>
                    )}

                    <div className="flex justify-between gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep(2)}
                        size="lg"
                        disabled={isSubmitting}
                        className="rounded-[12px] border-2 border-white/60 bg-white/70 backdrop-blur-xl hover:border-[#434343] hover:bg-white/90 text-[#434343] transition-all shadow-lg shadow-black/5 hover:shadow-xl hover:shadow-[#434343]/10 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Voltar
                      </Button>
                      <Button
                        type="submit"
                        size="lg"
                        disabled={isSubmitting}
                        className="rounded-[12px] bg-[#434343] hover:bg-[#6E6E6E] text-white transition-all shadow-lg shadow-[#434343]/20 hover:shadow-xl hover:shadow-[#434343]/30 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? 'Salvando...' : 'Concluir Configuração'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </form>
            </div>
          </Card>

          {/* Footer */}
          <div className="mt-12 text-center">
            <p className="text-xs text-[#6E6E6E]">
              Você pode alterar essas configurações depois nas configurações do seu perfil
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
