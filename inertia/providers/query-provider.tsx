import { ReactNode, useState } from 'react'
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
        queryCache: new QueryCache({
          onError: (error) => {
            const message = error.message || 'Algo deu errado. Tente novamente.'
            toast.error(message, { position: 'top-center' })
          },
        }),
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
