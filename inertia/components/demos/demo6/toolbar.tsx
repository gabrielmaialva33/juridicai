import { useState } from 'react'
import { Download, CalendarDays, Filter, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Demo6ToolbarProps {
  title?: string
  description?: string
  onExport?: () => void
  onFilter?: () => void
  onNew?: () => void
  showDatePicker?: boolean
  showExport?: boolean
  showFilter?: boolean
  showNew?: boolean
}

export function Demo6Toolbar({
  title = 'Dashboard',
  description,
  onExport,
  onFilter,
  onNew,
  showDatePicker = true,
  showExport = true,
  showFilter = false,
  showNew = false,
}: Demo6ToolbarProps) {
  const [date, setDate] = useState<Date | undefined>(new Date())

  return (
    <div className="sticky top-0 lg:top-auto z-20 bg-background border-b border-border">
      <div className="px-5 lg:px-7.5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Title & Description */}
          <div className="flex-1">
            <h1 className="text-xl lg:text-2xl font-bold text-foreground">{title}</h1>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {showDatePicker && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="default" className="gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {date
                        ? format(date, "d 'de' MMMM, yyyy", { locale: ptBR })
                        : 'Selecionar data'}
                    </span>
                    <span className="sm:hidden">{date ? format(date, 'dd/MM/yyyy') : 'Data'}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            )}

            {showFilter && (
              <Button variant="outline" size="default" onClick={onFilter} className="gap-2">
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">Filtrar</span>
              </Button>
            )}

            {showExport && (
              <Button variant="outline" size="default" onClick={onExport} className="gap-2">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
            )}

            {showNew && (
              <Button size="default" onClick={onNew} className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Novo</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
