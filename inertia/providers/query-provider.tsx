import { ReactNode, useState } from 'react'
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'

const QueryProvider = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 5 * 60 * 1000, // 5 minutes
          },
        },
        queryCache: new QueryCache({
          onError: (error) => {
            const message = error.message || 'Something went wrong. Please try again.'
            console.error('Query error:', message)
            // TODO: Add toast notification when we integrate Sonner
          },
        }),
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

export { QueryProvider }
