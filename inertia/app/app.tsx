import { createInertiaApp } from '@inertiajs/react'
import { createRoot } from 'react-dom/client'
import Layout from './metronic/components/layouts/layout-1'

// Estilos Globais do Metronic
import './metronic/styles/globals.css'
import './metronic/styles/layout.css'

createInertiaApp({
  resolve: (name) => {
    const pages = import.meta.glob('../pages/**/*.tsx', { eager: true })
    let page = pages[`../pages/${name}.tsx`]
    // Define o Layout do Metronic como o layout padrão para todas as páginas
    page.default.layout = page.default.layout || ((page) => <Layout>{page}</Layout>)
    return page
  },
  setup({ el, App, props }) {
    createRoot(el).render(<App {...props} />)
  },
})
