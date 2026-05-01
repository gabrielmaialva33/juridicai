export const throttle = (
  func: (...args: unknown[]) => void,
  limit: number
): ((...args: unknown[]) => void) => {
  let lastFunc: ReturnType<typeof setTimeout> | null = null
  let lastRan: number | null = null

  return function (this: unknown, ...args: unknown[]) {
    if (lastRan === null) {
      func.apply(this, args)
      lastRan = Date.now()
    } else {
      if (lastFunc !== null) {
        clearTimeout(lastFunc)
      }
      lastFunc = setTimeout(
        () => {
          if (Date.now() - (lastRan as number) >= limit) {
            func.apply(this, args)
            lastRan = Date.now()
          }
        },
        limit - (Date.now() - (lastRan as number))
      )
    }
  }
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function (...args: Parameters<T>): void {
    if (timeout) {
      clearTimeout(timeout)
    }

    timeout = setTimeout(() => {
      func(...args)
    }, wait)
  }
}

export function uid(): string {
  return (Date.now() + Math.floor(Math.random() * 1000)).toString()
}

export function getInitials(name: string | null | undefined, count?: number): string {
  if (!name || typeof name !== 'string') {
    return ''
  }

  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase())

  return count && count > 0 ? initials.slice(0, count).join('') : initials.join('')
}

export function toAbsoluteUrl(pathname: string): string {
  const baseUrl = import.meta.env.BASE_URL

  if (baseUrl && baseUrl !== '/') {
    return import.meta.env.BASE_URL + pathname
  } else {
    return pathname
  }
}

export function timeAgo(date: Date | string): string {
  const now = new Date()
  const inputDate = typeof date === 'string' ? new Date(date) : date
  const diff = Math.floor((now.getTime() - inputDate.getTime()) / 1000)

  if (diff < 60) return 'just now'
  if (diff < 3600)
    return `${Math.floor(diff / 60)} minute${Math.floor(diff / 60) > 1 ? 's' : ''} ago`
  if (diff < 86400)
    return `${Math.floor(diff / 3600)} hour${Math.floor(diff / 3600) > 1 ? 's' : ''} ago`
  if (diff < 604800)
    return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) > 1 ? 's' : ''} ago`
  if (diff < 2592000)
    return `${Math.floor(diff / 604800)} week${Math.floor(diff / 604800) > 1 ? 's' : ''} ago`
  if (diff < 31536000)
    return `${Math.floor(diff / 2592000)} month${Math.floor(diff / 2592000) > 1 ? 's' : ''} ago`

  return `${Math.floor(diff / 31536000)} year${Math.floor(diff / 31536000) > 1 ? 's' : ''} ago`
}

export function formatDate(input: Date | string | number): string {
  const date = new Date(input)
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(input: Date | string | number): string {
  const date = new Date(input)
  return date.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  })
}

/**
 * Brazilian currency (BRL) formatter.
 */
export function fmtBRL(value: string | number | null | undefined): string {
  return Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Brazilian number formatter (thousands separator).
 */
export function fmtNum(value: string | number | null | undefined): string {
  return Number(value ?? 0).toLocaleString('pt-BR')
}

/**
 * Brazilian date formatter (dd/mm/yyyy hh:mm).
 */
export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Relative time in pt-BR ("agora", "há 3min", "há 5h", "há 2d", or absolute).
 */
export function fmtRelative(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  const diff = Date.now() - d.getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'agora'
  const min = Math.floor(sec / 60)
  if (min < 60) return `há ${min}min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `há ${hr}h`
  const days = Math.floor(hr / 24)
  if (days < 30) return `há ${days}d`
  return fmtDate(d)
}
