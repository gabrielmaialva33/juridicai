import { useLocalStorage } from './use_local_storage'
import { LAYOUTS, DEFAULT_LAYOUT, getAllLayouts, getLayout } from '@/lib/layout-registry.tsx'
import type { LayoutKey } from '@/types/layout'

export function useLayout() {
  const [currentLayoutKey, setCurrentLayoutKey] = useLocalStorage<LayoutKey>(
    'juridicai-layout',
    DEFAULT_LAYOUT
  )

  const changeLayout = (key: LayoutKey) => {
    setCurrentLayoutKey(key)
  }

  const currentLayout = getLayout(currentLayoutKey)
  const LayoutComponent = currentLayout.component

  return {
    currentLayout: currentLayoutKey,
    layoutConfig: currentLayout,
    allLayouts: LAYOUTS,
    allLayoutsList: getAllLayouts(),
    changeLayout,
    LayoutComponent,
  }
}
