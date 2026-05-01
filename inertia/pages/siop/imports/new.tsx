import { useRef, useState } from 'react'
import { Head, router } from '@inertiajs/react'
import { ArrowLeft, FileSpreadsheet, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '~/components/shared/page-header'
import { cn } from '@/lib/utils'

const ACCEPTED_TYPES = '.xlsx,.xls,.csv'

export default function SiopImportsNew() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [exerciseYear, setExerciseYear] = useState<number>(new Date().getFullYear())
  const [dragOver, setDragOver] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

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

  return (
    <>
      <Head title="Novo import SIOP" />

      <PageHeader
        title="Novo import SIOP"
        description="Carregue um XLSX/CSV do SIOP. O arquivo será enfileirado e processado em background."
        breadcrumbs={[{ label: 'Imports SIOP', href: '/siop/imports' }, { label: 'Novo' }]}
      >
        <Button variant="outline" size="sm" onClick={() => router.visit('/siop/imports')}>
          <ArrowLeft className="me-1 size-3.5" />
          Voltar
        </Button>
      </PageHeader>

      <form onSubmit={submit} className="max-w-2xl space-y-5">
        <Card>
          <CardContent className="p-6 space-y-5">
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
                dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
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
            {submitting ? 'Enviando...' : 'Iniciar import'}
            {!submitting && <Upload className="ms-1 size-4" />}
          </Button>
        </div>
      </form>
    </>
  )
}
