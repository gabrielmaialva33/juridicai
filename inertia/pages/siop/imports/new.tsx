import { useRef, useState } from 'react'
import { Head, router } from '@inertiajs/react'
import { ArrowLeft, ExternalLink, FileSpreadsheet, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '~/components/shared/page-header'
import { cn } from '@/lib/utils'

const ACCEPTED_TYPES = '.xlsx,.xls,.csv'

type Props = {
  manualSources: {
    trf6FederalPrecatorios: {
      exportUrl: string
    }
  }
}

type Trf6ImportResult = {
  sourceRecordId: string
  extraction: {
    rows: number
    status: string
  }
  stats: {
    selectedRows: number
    inserted: number
    updated: number
    errors: number
  }
}

export default function SiopImportsNew({ manualSources }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const trf6InputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [trf6File, setTrf6File] = useState<File | null>(null)
  const [exerciseYear, setExerciseYear] = useState<number>(new Date().getFullYear())
  const [trf6ExerciseYear, setTrf6ExerciseYear] = useState<number>(new Date().getFullYear())
  const [dragOver, setDragOver] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submittingTrf6, setSubmittingTrf6] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [trf6Error, setTrf6Error] = useState<string | null>(null)
  const [trf6Result, setTrf6Result] = useState<Trf6ImportResult | null>(null)

  function pickFile(f: File) {
    setFile(f)
    setErrors({})
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) pickFile(f)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      setErrors({ file: 'Selecione um arquivo XLSX, XLS ou CSV.' })
      return
    }
    setSubmitting(true)
    const data = new FormData()
    data.append('file', file)
    data.append('exerciseYear', String(exerciseYear))
    router.post('/siop/imports', data, {
      forceFormData: true,
      onError: (errs) => {
        setErrors(errs as Record<string, string>)
      },
      onFinish: () => setSubmitting(false),
    })
  }

  async function submitTrf6(e: React.FormEvent) {
    e.preventDefault()
    if (!trf6File) {
      setTrf6Error('Selecione o CSV exportado pelo eproc/TRF6.')
      return
    }

    setSubmittingTrf6(true)
    setTrf6Error(null)
    setTrf6Result(null)

    const data = new FormData()
    data.append('file', trf6File)
    data.append('exerciseYear', String(trf6ExerciseYear))

    try {
      const response = await fetch('/siop/imports/trf6-export', {
        method: 'POST',
        headers: formHeaders(),
        credentials: 'same-origin',
        body: data,
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message ?? 'Não foi possível importar o CSV do TRF6.')
      }

      setTrf6Result((await response.json()) as Trf6ImportResult)
    } catch (error) {
      setTrf6Error(error instanceof Error ? error.message : 'Falha ao importar o CSV do TRF6.')
    } finally {
      setSubmittingTrf6(false)
    }
  }

  return (
    <>
      <Head title="Nova importação" />

      <PageHeader
        title="Nova importação"
        description="Carregue arquivos oficiais ou use fluxos assistidos quando o portal exigir CAPTCHA."
        breadcrumbs={[{ label: 'Fontes de Dados', href: '/siop/imports' }, { label: 'Novo' }]}
      >
        <Button variant="outline" size="sm" onClick={() => router.visit('/siop/imports')}>
          <ArrowLeft className="me-1 size-3.5" />
          Voltar
        </Button>
      </PageHeader>

      <div className="grid max-w-6xl gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,460px)]">
        <form onSubmit={submit} className="space-y-5">
          <Card>
            <CardContent className="p-6 space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Arquivo SIOP federal</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use para bases orçamentárias oficiais da União em XLSX ou CSV.
                </p>
              </div>

              <div
                onDrop={onDrop}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'flex flex-col items-center justify-center gap-3 px-6 py-12 border-2 border-dashed rounded-lg cursor-pointer transition-colors',
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50',
                  errors.file && 'border-destructive bg-destructive/5'
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) pickFile(f)
                  }}
                  className="hidden"
                />
                {file ? (
                  <>
                    <FileSpreadsheet className="size-10 text-primary" />
                    <div className="text-center">
                      <div className="font-medium">{file.name}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || 'desconhecido'}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setFile(null)
                      }}
                    >
                      Trocar arquivo
                    </Button>
                  </>
                ) : (
                  <>
                    <Upload className="size-10 text-muted-foreground" />
                    <div className="text-center">
                      <div className="font-medium text-sm">Solte aqui ou clique pra selecionar</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Aceitos: XLSX, XLS, CSV · Tamanho máx: 50 MB
                      </div>
                    </div>
                  </>
                )}
              </div>
              {errors.file && <p className="text-xs text-destructive">{errors.file}</p>}

              <div className="space-y-1.5">
                <Label
                  htmlFor="exerciseYear"
                  className="text-xs font-medium uppercase tracking-wider"
                >
                  Exercício orçamentário
                </Label>
                <Input
                  id="exerciseYear"
                  name="exerciseYear"
                  type="number"
                  min={2010}
                  max={new Date().getFullYear() + 1}
                  value={exerciseYear}
                  onChange={(e) => setExerciseYear(Number(e.target.value))}
                  aria-invalid={!!errors.exerciseYear}
                />
                {errors.exerciseYear && (
                  <p className="text-xs text-destructive">{errors.exerciseYear}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => router.visit('/siop/imports')}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!file || submitting}>
              {submitting ? 'Enviando...' : 'Iniciar import SIOP'}
              {!submitting && <Upload className="ms-1 size-4" />}
            </Button>
          </div>
        </form>

        <form onSubmit={submitTrf6} className="space-y-5">
          <Card>
            <CardContent className="space-y-5 p-6">
              <div>
                <h2 className="text-sm font-semibold text-foreground">TRF6 · eproc federal</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Para a fila atual com CAPTCHA: abra o eproc, gere o CSV e importe o relatório
                  aqui.
                </p>
              </div>

              <Button asChild variant="outline" className="w-full justify-between">
                <a
                  href={manualSources.trf6FederalPrecatorios.exportUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir exportação no eproc
                  <ExternalLink className="size-4" />
                </a>
              </Button>

              <div
                onClick={() => trf6InputRef.current?.click()}
                className={cn(
                  'flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-5 py-8 text-center transition-colors',
                  trf6File ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                )}
              >
                <input
                  ref={trf6InputRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    setTrf6File(e.target.files?.[0] ?? null)
                    setTrf6Error(null)
                    setTrf6Result(null)
                  }}
                  className="hidden"
                />
                <FileSpreadsheet className="size-9 text-muted-foreground" />
                {trf6File ? (
                  <div>
                    <div className="text-sm font-medium">{trf6File.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                      {(trf6File.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-sm font-medium">Selecionar CSV do eproc</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Arquivo: relatorio_precatorios_orcamentarios.csv
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="trf6ExerciseYear"
                  className="text-xs font-medium uppercase tracking-wider"
                >
                  Proposta/exercício
                </Label>
                <Input
                  id="trf6ExerciseYear"
                  name="trf6ExerciseYear"
                  type="number"
                  min={2010}
                  max={new Date().getFullYear() + 1}
                  value={trf6ExerciseYear}
                  onChange={(e) => setTrf6ExerciseYear(Number(e.target.value))}
                />
              </div>

              {trf6Error && <p className="text-sm text-destructive">{trf6Error}</p>}
              {trf6Result && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <div className="font-medium">Import concluído</div>
                  <div className="mt-1 text-muted-foreground">
                    {trf6Result.stats.selectedRows.toLocaleString('pt-BR')} linhas processadas ·{' '}
                    {trf6Result.stats.inserted.toLocaleString('pt-BR')} novas ·{' '}
                    {trf6Result.stats.updated.toLocaleString('pt-BR')} atualizadas
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={!trf6File || submittingTrf6}>
                {submittingTrf6 ? 'Importando...' : 'Importar CSV TRF6'}
                {!submittingTrf6 && <Upload className="ms-1 size-4" />}
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </>
  )
}

function formHeaders() {
  const headers = new Headers()
  headers.set('Accept', 'application/json')

  const xsrfToken = readCookie('XSRF-TOKEN')
  if (xsrfToken) {
    headers.set('X-XSRF-TOKEN', decodeURIComponent(xsrfToken))
  }

  return headers
}

function readCookie(name: string) {
  const prefix = `${name}=`
  const cookie = document.cookie
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix))

  return cookie?.slice(prefix.length) ?? null
}
