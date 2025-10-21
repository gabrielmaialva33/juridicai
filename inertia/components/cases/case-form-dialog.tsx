import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect, useState } from 'react'

import { useCreateCase, useUpdateCase } from '@/hooks/use-cases'
import { useClients } from '@/hooks/use-clients'
import type { Case, CreateCaseData } from '@/types/api'

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

// Validation schema
const caseSchema = z.object({
  client_id: z.number().min(1, 'Selecione um cliente'),
  internal_number: z.string().min(1, 'Número interno é obrigatório'),
  case_number: z.string().optional(),
  case_type: z.enum(['civil', 'criminal', 'labor', 'family', 'tax', 'administrative', 'other']),
  status: z.enum(['active', 'closed', 'archived', 'suspended']).default('active'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  title: z.string().min(3, 'Título deve ter no mínimo 3 caracteres'),
  description: z.string().optional(),
  court: z.string().optional(),
  court_instance: z.enum(['first', 'second', 'superior']).optional(),
  case_value: z.string().optional(),
})

type CaseFormData = z.infer<typeof caseSchema>

interface CaseFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  case?: Case
}

export function CaseFormDialog({ open, onOpenChange, mode, case: caseData }: CaseFormDialogProps) {
  const createCase = useCreateCase()
  const updateCase = useUpdateCase()
  const { data: clientsData } = useClients({ per_page: 100 })

  const [searchTerm, setSearchTerm] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CaseFormData>({
    resolver: zodResolver(caseSchema),
    defaultValues: {
      status: 'active',
      priority: 'medium',
      case_type: 'civil',
    },
  })

  const caseType = watch('case_type')
  const status = watch('status')
  const priority = watch('priority')
  const clientId = watch('client_id')
  const courtInstance = watch('court_instance')

  // Reset form when dialog opens/closes or case changes
  useEffect(() => {
    if (open && caseData && mode === 'edit') {
      reset({
        client_id: caseData.client_id,
        internal_number: caseData.internal_number,
        case_number: caseData.case_number || '',
        case_type: caseData.case_type,
        status: caseData.status,
        priority: caseData.priority,
        title: caseData.title,
        description: caseData.description || '',
        court: caseData.court || '',
        court_instance: caseData.court_instance || undefined,
        case_value: caseData.case_value || '',
      })
    } else if (open && mode === 'create') {
      reset({
        status: 'active',
        priority: 'medium',
        case_type: 'civil',
        internal_number: '',
        title: '',
        description: '',
      })
    }
  }, [open, caseData, mode, reset])

  const onSubmit = async (data: CaseFormData) => {
    try {
      const payload: CreateCaseData = {
        client_id: data.client_id,
        internal_number: data.internal_number,
        case_number: data.case_number || undefined,
        case_type: data.case_type,
        status: data.status,
        priority: data.priority,
        title: data.title,
        description: data.description || undefined,
        court: data.court || undefined,
        court_instance: data.court_instance || undefined,
        case_value: data.case_value || undefined,
      }

      if (mode === 'create') {
        await createCase.mutateAsync(payload)
      } else if (caseData) {
        await updateCase.mutateAsync({ id: caseData.id, data: payload })
      }

      onOpenChange(false)
    } catch (error) {
      console.error('Error saving case:', error)
    }
  }

  const filteredClients = clientsData?.data.filter((client) => {
    const name = client.full_name || client.company_name || ''
    return name.toLowerCase().includes(searchTerm.toLowerCase())
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Novo Processo' : 'Editar Processo'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label htmlFor="client_id">Cliente *</Label>
            <Select
              value={clientId?.toString()}
              onValueChange={(value) => setValue('client_id', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                {filteredClients?.map((client) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.full_name || client.company_name}
                    {client.cpf && ` - CPF: ${client.cpf}`}
                    {client.cnpj && ` - CNPJ: ${client.cnpj}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.client_id && (
              <p className="text-sm text-destructive">{errors.client_id.message}</p>
            )}
          </div>

          {/* Case Numbers */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="internal_number">Número Interno *</Label>
              <Input
                id="internal_number"
                {...register('internal_number')}
                placeholder="2024/001"
              />
              {errors.internal_number && (
                <p className="text-sm text-destructive">{errors.internal_number.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="case_number">Número CNJ (Opcional)</Label>
              <Input
                id="case_number"
                {...register('case_number')}
                placeholder="0123456-78.2024.8.26.0100"
              />
              {errors.case_number && (
                <p className="text-sm text-destructive">{errors.case_number.message}</p>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              {...register('title')}
              placeholder="Ex: Ação de Indenização por Danos Morais"
            />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          {/* Type, Status, Priority */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="case_type">Tipo *</Label>
              <Select value={caseType} onValueChange={(value: any) => setValue('case_type', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="civil">Cível</SelectItem>
                  <SelectItem value="criminal">Criminal</SelectItem>
                  <SelectItem value="labor">Trabalhista</SelectItem>
                  <SelectItem value="family">Família</SelectItem>
                  <SelectItem value="tax">Tributário</SelectItem>
                  <SelectItem value="administrative">Administrativo</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select value={status} onValueChange={(value: any) => setValue('status', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="closed">Encerrado</SelectItem>
                  <SelectItem value="archived">Arquivado</SelectItem>
                  <SelectItem value="suspended">Suspenso</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Prioridade *</Label>
              <Select value={priority} onValueChange={(value: any) => setValue('priority', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Court Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="court">Tribunal</Label>
              <Input
                id="court"
                {...register('court')}
                placeholder="Ex: TJ-SP, TRT-2, TRF-3"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="court_instance">Instância</Label>
              <Select
                value={courtInstance || ''}
                onValueChange={(value: any) =>
                  setValue('court_instance', value || undefined)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first">1ª Instância</SelectItem>
                  <SelectItem value="second">2ª Instância</SelectItem>
                  <SelectItem value="superior">Superior</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Case Value */}
          <div className="space-y-2">
            <Label htmlFor="case_value">Valor da Causa (R$)</Label>
            <Input
              id="case_value"
              {...register('case_value')}
              placeholder="10000.00"
              type="number"
              step="0.01"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Descrição detalhada do processo..."
              rows={4}
            />
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
                  ? 'Criar Processo'
                  : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
