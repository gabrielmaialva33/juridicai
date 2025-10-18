import ReactDOMServer from 'react-dom/server'
import { createInertiaApp } from '@inertiajs/react'
import { ThemeProvider } from '@/providers/theme-provider'
import { QueryProvider } from '@/providers/query-provider'

export default function render(page: any) {
  return createInertiaApp({
    page,
    render: ReactDOMServer.renderToString,
    resolve: (name) => {
      const pages = import.meta.glob('../pages/**/*.tsx', { eager: true })
      const pageModule = pages[`../pages/${name}.tsx`]

      if (!pageModule) {
        throw new Error(`Page not found: ${name}`)
      }

      // Pages now handle their own layouts
      return pageModule
    },
    setup: ({ App, props }) => (
      <ThemeProvider>
        <QueryProvider>
          <App {...props} />
        </QueryProvider>
      </ThemeProvider>
    ),
  })
}
