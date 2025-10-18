import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Bell, CheckCircle2, AlertCircle, XCircle, Info } from 'lucide-react'

interface Notification {
  id: string
  title: string
  description: string
  time: string
  read: boolean
  type: 'info' | 'warning' | 'success' | 'error'
}

export function Notifications() {
  const [notifications] = useState<Notification[]>([
    {
      id: '1',
      title: 'Novo prazo adicionado',
      description: 'Prazo para audiência no processo 1234567',
      time: 'há 5 minutos',
      read: false,
      type: 'info',
    },
    {
      id: '2',
      title: 'Documento assinado',
      description: 'Contrato assinado por João Silva',
      time: 'há 1 hora',
      read: false,
      type: 'success',
    },
    {
      id: '3',
      title: 'Prazo próximo',
      description: 'Vencimento em 2 dias - Processo 7654321',
      time: 'há 3 horas',
      read: true,
      type: 'warning',
    },
  ])

  const unreadCount = notifications.filter((n) => !n.read).length

  const getTypeIcon = (type: Notification['type']) => {
    const iconProps = { className: 'h-4 w-4', strokeWidth: 2 }
    switch (type) {
      case 'success':
        return <CheckCircle2 {...iconProps} className="h-4 w-4 text-green-600" />
      case 'warning':
        return <AlertCircle {...iconProps} className="h-4 w-4 text-yellow-600" />
      case 'error':
        return <XCircle {...iconProps} className="h-4 w-4 text-red-600" />
      default:
        return <Info {...iconProps} className="h-4 w-4 text-blue-600" />
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover:bg-accent">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-[10px] flex items-center justify-center"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-96" align="end" forceMount>
        <DropdownMenuLabel className="flex items-center justify-between py-3 px-4">
          <span className="text-base font-semibold">Notificações</span>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {unreadCount} nova{unreadCount > 1 ? 's' : ''}
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[350px]">
          {notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className={`flex flex-col items-start gap-2 p-4 cursor-pointer hover:bg-accent/50 ${!notification.read ? 'bg-accent/30' : ''}`}
            >
              <div className="flex items-start gap-3 w-full">
                <div className="mt-0.5">{getTypeIcon(notification.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {notification.description}
                  </p>
                  <p className="text-xs text-muted-foreground/80 mt-1.5">{notification.time}</p>
                </div>
                {!notification.read && (
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </ScrollArea>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-center justify-center text-sm text-primary font-medium py-3 cursor-pointer">
          Ver todas as notificações
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
