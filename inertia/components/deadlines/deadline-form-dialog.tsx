import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect } from 'react'
import { format } from 'date-fns'

import { useCreateDeadline, useUpdateDeadline } from '@/hooks/use-deadlines'
import { useCases } from '@/hooks/use-cases'
import type { Deadline, CreateDeadlineData } from '@/types/api'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

// Validation schema
const deadlineSchema = z.object({
  case_id: z.number().min(1, 'Selecione um processo'),
  title: z.string().min(3, 'Título deve ter no mínimo 3 caracteres'),
  description: z.string().optional(),
  deadline_date: z.string().min(1, 'Data do prazo é obrigatória'),
  internal_deadline_date: z.string().optional(),
  is_fatal: z.boolean().default(false),
  status: z.enum(['pending', 'completed', 'cancelled']).default('pending'),
  alert_config: z.object({
    days_before: z.number().min(1).max(30).default(3),
    email_enabled: z.boolean().default(true),
    sms_enabled: z.boolean().default(false),
    push_enabled: z.boolean().default(true),
    recipients: z.array(z.string().email()).optional(),
  }).optional(),
})

type DeadlineFormData = z.infer<typeof deadlineSchema>

interface DeadlineFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  deadline?: Deadline
}

export function DeadlineFormDialog({
  open,
  onOpenChange,
  mode,
  deadline,
}: DeadlineFormDialogProps) {
  const createDeadline = useCreateDeadline()
  const updateDeadline = useUpdateDeadline()
  const { data: casesData } = useCases({ per_page: 100 })

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DeadlineFormData>({
    resolver: zodResolver(deadlineSchema),
    defaultValues: {
      status: 'pending',
      is_fatal: false,
      alert_config: {
        days_before: 3,
        email_enabled: true,
        sms_enabled: false,
        push_enabled: true,
      },
    },
  })

  const caseId = watch('case_id')
  const status = watch('status')
  const isFatal = watch('is_fatal')
  const emailEnabled = watch('alert_config.email_enabled')
  const smsEnabled = watch('alert_config.sms_enabled')
  const pushEnabled = watch('alert_config.push_enabled')

  // Reset form when dialog opens/closes or deadline changes
  useEffect(() => {
    if (open && deadline && mode === 'edit') {
      reset({
        case_id: deadline.case_id,
        title: deadline.title,
        description: deadline.description || '',
        deadline_date: deadline.deadline_date ? format(new Date(deadline.deadline_date), "yyyy-MM-dd'T'HH:mm") : '',
        internal_deadline_date: deadline.internal_deadline_date
          ? format(new Date(deadline.internal_deadline_date), "yyyy-MM-dd'T'HH:mm")
          : '',
        is_fatal: deadline.is_fatal,
        status: deadline.status,
        alert_config: deadline.alert_config || {
          days_before: 3,
          email_enabled: true,
          sms_enabled: false,
          push_enabled: true,
        },
      })
    } else if (open && mode === 'create') {
      reset({
        status: 'pending',
        is_fatal: false,
        title: '',
        description: '',
        deadline_date: '',
        internal_deadline_date: '',
        alert_config: {
          days_before: 3,
          email_enabled: true,
          sms_enabled: false,
          push_enabled: true,
        },
      })
    }
  }, [open, deadline, mode, reset])

  const onSubmit = async (data: DeadlineFormData) => {
    try {
      const payload: CreateDeadlineData = {
        case_id: data.case_id,
        title: data.title,
        description: data.description || undefined,
        deadline_date: data.deadline_date,
        internal_deadline_date: data.internal_deadline_date || undefined,
        is_fatal: data.is_fatal,
        status: data.status,
        alert_config: data.alert_config,
      }

      if (mode === 'create') {
        await createDeadline.mutateAsync(payload)
      } else if (deadline) {
        await updateDeadline.mutateAsync({ id: deadline.id, data: payload })
      }

      onOpenChange(false)
    } catch (error) {
      console.error('Error saving deadline:', error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Novo Prazo' : 'Editar Prazo'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Case Selection */}
          <div className="space-y-2">
            <Label htmlFor="case_id">Processo *</Label>
            <Select
              value={caseId?.toString()}
              onValueChange={(value) => setValue('case_id', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um processo" />
              </SelectTrigger>
              <SelectContent>
                {casesData?.data.map((caseItem) => (
                  <SelectItem key={caseItem.id} value={caseItem.id.toString()}>
                    {caseItem.case_number || caseItem.internal_number} - {caseItem.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.case_id && (
              <p className="text-sm text-destructive">{errors.case_id.message}</p>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              {...register('title')}
              placeholder="Ex: Prazo para Contestação"
            />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deadline_date">Data do Prazo *</Label>
              <Input
                id="deadline_date"
                type="datetime-local"
                {...register('deadline_date')}
              />
              {errors.deadline_date && (
                <p className="text-sm text-destructive">{errors.deadline_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="internal_deadline_date">Prazo Interno (Opcional)</Label>
              <Input
                id="internal_deadline_date"
                type="datetime-local"
                {...register('internal_deadline_date')}
              />
              <p className="text-xs text-muted-foreground">
                Data de alerta antes do prazo oficial
              </p>
            </div>
          </div>

          {/* Is Fatal and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_fatal"
                  checked={isFatal}
                  onCheckedChange={(checked) => setValue('is_fatal', checked as boolean)}
                />
                <Label htmlFor="is_fatal" className="cursor-pointer">
                  Prazo Fatal
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Prazos fatais não podem ser prorrogados
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(value: any) => setValue('status', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Informações adicionais sobre o prazo..."
              rows={3}
            />
          </div>

          {/* Alert Configuration */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
            <h3 className="font-semibold text-sm">Configuração de Alertas</h3>

            <div className="space-y-2">
              <Label htmlFor="days_before">Alertar com quantos dias de antecedência?</Label>
              <Input
                id="days_before"
                type="number"
                min="1"
                max="30"
                {...register('alert_config.days_before', { valueAsNumber: true })}
              />
              {errors.alert_config?.days_before && (
                <p className="text-sm text-destructive">
                  {errors.alert_config.days_before.message}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <Label>Canais de Alerta</Label>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="email_enabled"
                  checked={emailEnabled}
                  onCheckedChange={(checked) =>
                    setValue('alert_config.email_enabled', checked as boolean)
                  }
                />
                <Label htmlFor="email_enabled" className="cursor-pointer font-normal">
                  Email
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sms_enabled"
                  checked={smsEnabled}
                  onCheckedChange={(checked) =>
                    setValue('alert_config.sms_enabled', checked as boolean)
                  }
                />
                <Label htmlFor="sms_enabled" className="cursor-pointer font-normal">
                  SMS
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="push_enabled"
                  checked={pushEnabled}
                  onCheckedChange={(checked) =>
                    setValue('alert_config.push_enabled', checked as boolean)
                  }
                />
                <Label htmlFor="push_enabled" className="cursor-pointer font-normal">
                  Notificação Push
                </Label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? mode === 'create'
                  ? 'Criando...'
                  : 'Salvando...'
                : mode === 'create'
                  ? 'Criar Prazo'
                  : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
