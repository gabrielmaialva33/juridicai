import '../styles/app.css'
import { createInertiaApp } from '@inertiajs/react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import { ThemeProvider } from '@/providers/theme-provider'
import { QueryProvider } from '@/providers/query-provider'

const appName = import.meta.env.VITE_APP_NAME || 'JuridicAI'

createInertiaApp({
  title: (title) => `${title} - ${appName}`,
  resolve: (name) => {
    const pages = import.meta.glob('../pages/**/*.tsx', { eager: true })
    const pageModule = pages[`../pages/${name}.tsx`]

    if (!pageModule) {
      throw new Error(`Page not found: ${name}`)
    }

    // Pages now handle their own layouts
    return pageModule
  },
  setup({ el, App, props }) {
    const app = (
      <StrictMode>
        <ThemeProvider>
          <QueryProvider>
            <App {...props} />
          </QueryProvider>
        </ThemeProvider>
      </StrictMode>
    )

    if (import.meta.env.DEV) {
      createRoot(el).render(app)
    } else {
      hydrateRoot(el, app)
    }
  },
  progress: {
    color: '#4F46E5',
    showSpinner: true,
  },
})
