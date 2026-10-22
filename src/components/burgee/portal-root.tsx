import { createContext, useContext } from 'react'

/**
 * Where sheets and dialogs mount. Inside the phone frame on a laptop, so a
 * coach's bottom sheet slides up inside the phone instead of across the screen.
 */
export const PortalRootContext = createContext<HTMLElement | null>(null)

export function usePortalRoot() {
  return useContext(PortalRootContext) ?? undefined
}
