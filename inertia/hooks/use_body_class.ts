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

    // Remove ALL existing layout-related classes first to avoid conflicts
    const existingClasses = Array.from(bodyElement.classList)
    existingClasses.forEach((cls) => {
      // Remove old layout classes (demo1-10, CSS variables, layout-specific utilities)
      if (
        cls.match(/^demo\d+$/) ||
        cls.includes('[--') ||
        cls === 'sidebar-fixed' ||
        cls === 'header-fixed' ||
        cls === 'lg:overflow-hidden' ||
        cls === 'bg-muted' ||
        cls === 'bg-muted!' ||
        cls === 'h-full' ||
        cls === 'flex'
      ) {
        bodyElement.classList.remove(cls)
      }
    })

    // Add new classes
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
