import { useState, useEffect } from 'react'

/**
 * Hook for responsive breakpoint detection using CSS media queries
 *
 * Features:
 * - SSR-safe (returns false on server)
 * - Properly manages event listeners
 * - Type-safe implementation
 * - Syncs with window resize events
 *
 * Common breakpoints:
 * - Mobile: '(max-width: 640px)'
 * - Tablet: '(min-width: 641px) and (max-width: 1024px)'
 * - Desktop: '(min-width: 1025px)'
 * - Dark mode: '(prefers-color-scheme: dark)'
 *
 * Usage:
 * ```typescript
 * function MyComponent() {
 *   const isMobile = useMediaQuery('(max-width: 640px)')
 *   const isDesktop = useMediaQuery('(min-width: 1025px)')
 *   const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
 *
 *   return (
 *     <div>
 *       {isMobile && <MobileNav />}
 *       {isDesktop && <DesktopNav />}
 *     </div>
 *   )
 * }
 * ```
 *
 * @param query - CSS media query string (e.g., '(min-width: 768px)')
 * @returns Boolean indicating if the media query matches
 */
export function useMediaQuery(query: string): boolean {
  // Initialize state with a function to avoid SSR issues
  const [matches, setMatches] = useState<boolean>(() => {
    // Return false during SSR (window is undefined)
    if (typeof window === 'undefined') {
      return false
    }

    // Initialize with current match state
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    // Return early if window is not available (SSR)
    if (typeof window === 'undefined') {
      return
    }

    // Create media query list
    const mediaQueryList = window.matchMedia(query)

    // Update state when media query changes
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    // Modern browsers use addEventListener
    // Legacy browsers use addListener (deprecated but still supported)
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handleChange)
    } else {
      // Fallback for older browsers
      mediaQueryList.addListener(handleChange)
    }

    // Cleanup function to remove event listener
    return () => {
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener('change', handleChange)
      } else {
        // Fallback for older browsers
        mediaQueryList.removeListener(handleChange)
      }
    }
  }, [query]) // Re-run effect if query changes

  return matches
}

/**
 * Predefined breakpoint hooks for common responsive patterns
 * Based on Tailwind CSS default breakpoints
 */

/**
 * Matches small screens and below (mobile)
 * @returns true if viewport width is <= 640px
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 640px)')
}

/**
 * Matches medium screens and above (tablet)
 * @returns true if viewport width is >= 768px
 */
export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px)')
}

/**
 * Matches large screens and above (desktop)
 * @returns true if viewport width is >= 1024px
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)')
}

/**
 * Detects user's dark mode preference
 * @returns true if user prefers dark color scheme
 */
export function usePrefersColorScheme(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)')
}

/**
 * Detects reduced motion preference for accessibility
 * @returns true if user prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}
