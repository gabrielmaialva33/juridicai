import { ReactElement, useEffect } from 'react'
import { toast, Toaster } from 'sonner'
import { usePage } from '@inertiajs/react'
import { Data } from '@generated/data'
import { ThemeProvider } from '~/providers/theme-provider'
import { QueryProvider } from '~/providers/query-provider'
import { AppLayout } from '~/components/layouts/app-layout'

const STANDALONE_PREFIXES = ['/login', '/signup', '/auth', '/tenants/select']

export default function Layout({ children }: { children: ReactElement<Data.SharedProps> }) {
  const { url, props } = usePage<Data.SharedProps>()

  useEffect(() => {
    toast.dismiss()
  }, [url])

  useEffect(() => {
    if (props.flash?.error) toast.error(props.flash.error)
    if (props.flash?.success) toast.success(props.flash.success)
  }, [props.flash])

  const isStandalone = STANDALONE_PREFIXES.some((p) => url.startsWith(p))

  return (
    <ThemeProvider>
      <QueryProvider>
        {isStandalone ? children : <AppLayout>{children}</AppLayout>}
        <Toaster position="top-center" richColors />
      </QueryProvider>
    </ThemeProvider>
  )
}
