import { PropsWithChildren } from 'react'
import { useLayout } from '@/hooks/use_layout'

export function DynamicLayoutWrapper({ children }: PropsWithChildren) {
  const { LayoutComponent } = useLayout()

  return <LayoutComponent>{children}</LayoutComponent>
}
