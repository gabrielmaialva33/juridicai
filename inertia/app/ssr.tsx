import ReactDOMServer from 'react-dom/server'
import { createInertiaApp } from '@inertiajs/react'
import { ThemeProvider } from '@/providers/theme-provider'
import { QueryProvider } from '@/providers/query-provider'
import Layout from '@/metronic/components/layouts/layout-1'

export default function render(page: any) {
  return createInertiaApp({
    page,
    render: ReactDOMServer.renderToString,
    resolve: (name) => {
      const pages = import.meta.glob('../pages/**/*.tsx', { eager: true })
      const pageModule = pages[`../pages/${name}.tsx`] as any

      if (!pageModule) {
        throw new Error(`Page not found: ${name}`)
      }

      // Define default layout if page doesn't have one
      if (!pageModule.default.layout) {
        pageModule.default.layout = (page: React.ReactNode) => <Layout>{page}</Layout>
      }

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
