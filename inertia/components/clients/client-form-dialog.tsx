import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect } from 'react'

import { useCreateClient, useUpdateClient } from '@/hooks/use-clients'
import type { Client, CreateClientData } from '@/types/api'

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
const clientSchema = z.discriminatedUnion('client_type', [
  z.object({
    client_type: z.literal('individual'),
    full_name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
    cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido (formato: 000.000.000-00)'),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    phone: z.string().optional(),
    notes: z.string().optional(),
  }),
  z.object({
    client_type: z.literal('company'),
    company_name: z.string().min(3, 'Razão social deve ter no mínimo 3 caracteres'),
    cnpj: z
      .string()
      .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido (formato: 00.000.000/0000-00)'),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    phone: z.string().optional(),
    notes: z.string().optional(),
  }),
])

type ClientFormData = z.infer<typeof clientSchema>

interface ClientFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  client?: Client
}

export function ClientFormDialog({ open, onOpenChange, mode, client }: ClientFormDialogProps) {
  const createClient = useCreateClient()
  const updateClient = useUpdateClient()

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      client_type: 'individual',
    },
  })

  const clientType = watch('client_type')

  // Reset form when dialog opens/closes or client changes
  useEffect(() => {
    if (open && client && mode === 'edit') {
      reset({
        client_type: client.client_type,
        full_name: client.full_name || '',
        company_name: client.company_name || '',
        cpf: client.cpf || '',
        cnpj: client.cnpj || '',
        email: client.email || '',
        phone: client.phone || '',
        notes: client.notes || '',
      } as ClientFormData)
    } else if (open && mode === 'create') {
      reset({
        client_type: 'individual',
        full_name: '',
        cpf: '',
        email: '',
        phone: '',
        notes: '',
      } as ClientFormData)
    }
  }, [open, client, mode, reset])

  const onSubmit = async (data: ClientFormData) => {
    try {
      const payload: CreateClientData = {
        client_type: data.client_type,
        ...(data.client_type === 'individual'
          ? {
              full_name: data.full_name,
              cpf: data.cpf,
            }
          : {
              company_name: data.company_name,
              cnpj: data.cnpj,
            }),
        email: data.email || undefined,
        phone: data.phone || undefined,
        notes: data.notes || undefined,
      }

      if (mode === 'create') {
        await createClient.mutateAsync(payload)
      } else if (client) {
        await updateClient.mutateAsync({ id: client.id, data: payload })
      }

      onOpenChange(false)
    } catch (error) {
      console.error('Error saving client:', error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Novo Cliente' : 'Editar Cliente'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Client Type */}
          <div className="space-y-2">
            <Label htmlFor="client_type">Tipo de Cliente</Label>
            <Select
              value={clientType}
              onValueChange={(value: 'individual' | 'company') => setValue('client_type', value)}
              disabled={mode === 'edit'}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Pessoa Física</SelectItem>
                <SelectItem value="company">Pessoa Jurídica</SelectItem>
              </SelectContent>
            </Select>
            {mode === 'edit' && (
              <p className="text-xs text-muted-foreground">
                O tipo de cliente não pode ser alterado após a criação
              </p>
            )}
          </div>

          {/* Conditional Fields */}
          {clientType === 'individual' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome Completo *</Label>
                <Input
                  id="full_name"
                  {...register('full_name')}
                  placeholder="João da Silva Santos"
                />
                {errors.full_name && (
                  <p className="text-sm text-destructive">{errors.full_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cpf">CPF *</Label>
                <Input id="cpf" {...register('cpf')} placeholder="000.000.000-00" maxLength={14} />
                {errors.cpf && <p className="text-sm text-destructive">{errors.cpf.message}</p>}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="company_name">Razão Social *</Label>
                <Input id="company_name" {...register('company_name')} placeholder="Empresa LTDA" />
                {errors.company_name && (
                  <p className="text-sm text-destructive">{errors.company_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ *</Label>
                <Input
                  id="cnpj"
                  {...register('cnpj')}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                />
                {errors.cnpj && <p className="text-sm text-destructive">{errors.cnpj.message}</p>}
              </div>
            </>
          )}

          {/* Common Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="email@exemplo.com"
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" {...register('phone')} placeholder="(11) 99999-9999" />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Informações adicionais sobre o cliente..."
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
                  ? 'Criar Cliente'
                  : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
