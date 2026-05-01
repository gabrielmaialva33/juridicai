import { useEffect, useState } from 'react'
import { AlertTriangle, Eye, EyeOff, Loader2, Lock, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { jsonRequest } from '~/lib/http'
import { toast } from 'sonner'

interface BeneficiaryRevealed {
  id: string
  name?: string | null
  document?: string | null
  documentType?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  bankAccount?: string | null
}

interface Props {
  beneficiaryId: string
  beneficiaryHandle?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PURPOSE_OPTIONS = [
  { value: 'contact_validation', label: 'Validação de contato' },
  { value: 'due_diligence', label: 'Due diligence' },
  { value: 'cession_negotiation', label: 'Negociação de cessão' },
  { value: 'document_check', label: 'Conferência documental' },
  { value: 'compliance_review', label: 'Revisão de compliance' },
  { value: 'other', label: 'Outro motivo' },
]

const COUNTDOWN_SECONDS = 90

export function RevealDialog({ beneficiaryId, beneficiaryHandle, open, onOpenChange }: Props) {
  const [phase, setPhase] = useState<'form' | 'loading' | 'revealed'>('form')
  const [purpose, setPurpose] = useState('')
  const [justification, setJustification] = useState('')
  const [data, setData] = useState<BeneficiaryRevealed | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)

  // Reset volatile reveal state when the dialog closes.
  useEffect(() => {
    if (!open) {
      setPhase('form')
      setPurpose('')
      setJustification('')
      setData(null)
      setError(null)
      setCountdown(COUNTDOWN_SECONDS)
    }
  }, [open])

  // Auto-clear revealed data after the countdown expires.
  useEffect(() => {
    if (phase !== 'revealed') return
    if (countdown <= 0) {
      onOpenChange(false)
      toast.info('Visualização de PII expirou (90s)', { duration: 3000 })
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown, onOpenChange])

  // Clear revealed data when the tab becomes hidden.
  useEffect(() => {
    if (phase !== 'revealed') return
    const onVisibility = () => {
      if (document.hidden) {
        onOpenChange(false)
        toast.warning('Visualização de PII fechada por inatividade da aba')
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [phase, onOpenChange])

  async function handleReveal() {
    if (purpose.length < 3 || justification.length < 20) return
    setPhase('loading')
    setError(null)
    try {
      const json = await jsonRequest<{ beneficiary?: BeneficiaryRevealed } & BeneficiaryRevealed>(
        `/pii/beneficiaries/${beneficiaryId}/reveal`,
        {
          method: 'POST',
          body: { purpose, justification },
        }
      )
      setData(json.beneficiary ?? json)
      setPhase('revealed')
      setCountdown(COUNTDOWN_SECONDS)
      toast.success('Acesso registrado em audit log', { duration: 4000 })
    } catch (e: any) {
      setError(e?.message ?? 'Erro desconhecido')
      setPhase('form')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {phase === 'form' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="size-5 text-amber-500" />
                Revelar dados do beneficiário
              </DialogTitle>
              <DialogDescription>
                Esta ação é <strong>auditada</strong> com seu usuário, IP e timestamp. Use apenas
                com base legal documentada (legítimo interesse + LIA).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {beneficiaryHandle && (
                <div className="text-xs text-muted-foreground font-mono px-3 py-2 bg-muted rounded">
                  Beneficiário: {beneficiaryHandle}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="reveal-purpose" className="text-xs uppercase tracking-wider">
                  Finalidade *
                </Label>
                <Select value={purpose} onValueChange={setPurpose}>
                  <SelectTrigger id="reveal-purpose">
                    <SelectValue placeholder="Selecione o motivo do acesso" />
                  </SelectTrigger>
                  <SelectContent>
                    {PURPOSE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reveal-justification" className="text-xs uppercase tracking-wider">
                  Justificativa * (mínimo 20 caracteres)
                </Label>
                <Textarea
                  id="reveal-justification"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Ex: Análise pré-cessão para validar capacidade de assinatura do cedente conforme processo nº..."
                  rows={4}
                />
                <div className="flex items-baseline justify-between text-[10px] text-muted-foreground">
                  <span>
                    {justification.length}/20 chars
                    {justification.length >= 20 && ' ✓'}
                  </span>
                  <span className="font-mono">LGPD art. 7º X · LIA</span>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded p-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button
                onClick={handleReveal}
                disabled={purpose.length < 3 || justification.length < 20}
              >
                <Eye className="me-1 size-3.5" />
                Revelar (90s)
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="size-8 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">Validando acesso...</p>
          </div>
        )}

        {phase === 'revealed' && data && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Lock className="size-5 text-emerald-500" />
                  Dados revelados
                </span>
                <span className="text-xs font-mono tabular-nums text-amber-600 dark:text-amber-400">
                  Auto-clear em {countdown}s
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                ⚠ Não copie, imprima ou compartilhe estes dados fora do sistema. Acesso já
                registrado no audit log.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-2">
              <RevealField label="Nome" value={data.name} />
              <RevealField
                label={data.documentType ? `Documento (${data.documentType})` : 'Documento'}
                value={data.document}
                mono
              />
              {data.contactPhone && <RevealField label="Telefone" value={data.contactPhone} mono />}
              {data.contactEmail && <RevealField label="Email" value={data.contactEmail} />}
              {data.bankAccount && (
                <RevealField label="Conta bancária" value={data.bankAccount} mono />
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                <EyeOff className="me-1 size-3.5" />
                Ocultar agora
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function RevealField({
  label,
  value,
  mono,
}: {
  label: string
  value?: string | null
  mono?: boolean
}) {
  if (!value) return null
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
          {label}
        </div>
        <div className={`text-base font-medium ${mono ? 'font-mono tabular-nums' : ''}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  )
}
