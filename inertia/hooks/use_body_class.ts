import { useEffect } from 'react'

/**
 * Hook to dynamically add/remove classes to the document body element
 * Used by layouts to apply layout-specific styling
 *
 * @param classes - Space-separated string of classes to add to body
 *
 * @example
 * useBodyClass('sidebar-fixed header-fixed demo1')
 * useBodyClass('[--header-height:60px] [--sidebar-width:270px]')
 */
export function useBodyClass(classes: string) {
  useEffect(() => {
    if (!classes || typeof window === 'undefined') return

    const bodyElement = document.body
    const classArray = classes
      .split(/\s+/)
      .map((c) => c.trim())
      .filter(Boolean)

    // Add classes
    classArray.forEach((className) => {
      if (className) bodyElement.classList.add(className)
    })

    // Cleanup: remove classes on unmount
    return () => {
      classArray.forEach((className) => {
        if (className) bodyElement.classList.remove(className)
      })
    }
  }, [classes])
}
