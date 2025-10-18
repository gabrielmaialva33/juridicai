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
    switch (type) {
      case 'success':
        return 'ki-check-circle text-green-500'
      case 'warning':
        return 'ki-information text-yellow-500'
      case 'error':
        return 'ki-close-circle text-red-500'
      default:
        return 'ki-notification-on text-blue-500'
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <i className="ki-filled ki-notification-on text-xl" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end" forceMount>
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificações</span>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {unreadCount} nova{unreadCount > 1 ? 's' : ''}
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[300px]">
          {notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className={`flex flex-col items-start gap-1 p-3 ${!notification.read ? 'bg-accent/50' : ''}`}
            >
              <div className="flex items-start gap-2 w-full">
                <i className={`ki-filled ${getTypeIcon(notification.type)} mt-0.5`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{notification.title}</p>
                  <p className="text-xs text-muted-foreground">{notification.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                </div>
                {!notification.read && <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />}
              </div>
            </DropdownMenuItem>
          ))}
        </ScrollArea>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-center justify-center text-sm text-primary">
          Ver todas as notificações
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
