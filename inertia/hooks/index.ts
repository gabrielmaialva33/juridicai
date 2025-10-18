/**
 * Centralized exports for all custom React hooks
 */

// Layout hooks
export { useLayout } from './use_layout'
export { useLocalStorage } from './use_local_storage'

// Inertia & Page hooks
export { useTypedPage } from './use_typed_page'
export type { SharedProps } from './use_typed_page'

// Responsive & Media Query hooks
export {
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  usePrefersColorScheme,
  usePrefersReducedMotion,
} from './use_media_query'
