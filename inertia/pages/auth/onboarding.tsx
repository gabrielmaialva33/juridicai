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
import { Badge } from '@/components/ui/badge'

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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
        <div className="w-full max-w-2xl">
          {/* Logo */}
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              JuridicAI
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">Configure seu escritório</p>
          </div>

          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
                <div key={s} className="flex items-center">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                      step >= s
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/30 bg-background text-muted-foreground'
                    )}
                  >
                    {s}
                  </div>
                  {s < totalSteps && (
                    <div
                      className={cn(
                        'h-0.5 w-16 transition-colors',
                        step > s ? 'bg-primary' : 'bg-muted-foreground/30'
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Onboarding Card */}
          <Card className="border-border/50 shadow-2xl backdrop-blur-sm bg-card/95">
            <form onSubmit={handleSubmit(onSubmit)}>
              {/* Step 1: Welcome */}
              {step === 1 && (
                <>
                  <CardHeader>
                    <CardTitle className="text-2xl">Bem-vindo ao JuridicAI! 👋</CardTitle>
                    <CardDescription className="text-base">
                      Vamos configurar seu perfil em apenas alguns passos
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="rounded-lg bg-primary/10 p-4 text-sm">
                      <p className="font-medium text-primary">O que você vai configurar:</p>
                      <ul className="mt-2 space-y-1 text-muted-foreground">
                        <li>• Informações do seu escritório</li>
                        <li>• Áreas de atuação</li>
                        <li>• Preferências iniciais</li>
                      </ul>
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button type="button" onClick={() => setStep(2)} size="lg">
                        Começar
                      </Button>
                    </div>
                  </CardContent>
                </>
              )}

              {/* Step 2: Firm Details */}
              {step === 2 && (
                <>
                  <CardHeader>
                    <CardTitle className="text-2xl">Dados do Escritório</CardTitle>
                    <CardDescription className="text-base">
                      Informe os dados básicos do seu escritório
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="firmName">
                          Nome do Escritório <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="firmName"
                          placeholder="Escritório de Advocacia Silva & Associados"
                          {...register('firmName')}
                        />
                        {errors.firmName && (
                          <p className="text-sm text-destructive">{errors.firmName.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="oabNumber">Número OAB (opcional)</Label>
                        <Input id="oabNumber" placeholder="SP 123.456" {...register('oabNumber')} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefone (opcional)</Label>
                        <Input id="phone" placeholder="(11) 98765-4321" {...register('phone')} />
                      </div>
                    </div>

                    <div className="flex justify-between gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep(1)}
                        size="lg"
                      >
                        Voltar
                      </Button>
                      <Button type="button" onClick={() => setStep(3)} size="lg">
                        Próximo
                      </Button>
                    </div>
                  </CardContent>
                </>
              )}

              {/* Step 3: Practice Areas */}
              {step === 3 && (
                <>
                  <CardHeader>
                    <CardTitle className="text-2xl">Áreas de Atuação</CardTitle>
                    <CardDescription className="text-base">
                      Selecione as áreas em que seu escritório atua
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-3">
                      {PRACTICE_AREAS.map((area) => (
                        <button
                          key={area}
                          type="button"
                          onClick={() => toggleArea(area)}
                          className={cn(
                            'rounded-lg border-2 p-4 text-left transition-all hover:scale-105',
                            selectedAreas.includes(area)
                              ? 'border-primary bg-primary/10 shadow-md'
                              : 'border-border bg-background hover:border-primary/50'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{area}</span>
                            {selectedAreas.includes(area) && (
                              <Badge variant="default" className="ml-2">
                                ✓
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>

                    {errors.practiceAreas && (
                      <p className="text-sm text-destructive">{errors.practiceAreas.message}</p>
                    )}

                    <div className="flex justify-between gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep(2)}
                        size="lg"
                      >
                        Voltar
                      </Button>
                      <Button type="submit" size="lg">
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
