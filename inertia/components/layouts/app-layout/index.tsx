import { ReactNode } from 'react'
import { LayoutProvider } from './context'
import { Main } from './main'

export function AppLayout({
  children,
  tenantName,
}: {
  children: ReactNode
  tenantName?: string | null
}) {
  return (
    <LayoutProvider>
      <Main tenantName={tenantName}>{children}</Main>
    </LayoutProvider>
  )
}
