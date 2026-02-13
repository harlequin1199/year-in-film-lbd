export const MOBILE_WIDTH = 600
export const BIG_FILE_MOBILE_THRESHOLD = 2000

export function isMobileViewport(userAgent = '', innerWidth = 0): boolean {
  if (innerWidth < MOBILE_WIDTH) return true
  return /mobile|android|iphone|ipad/i.test(userAgent)
}

export function isMobileClient(): boolean {
  if (typeof window === 'undefined') return false
  return isMobileViewport(navigator.userAgent, window.innerWidth)
}

export function shouldForceSimplifiedMobileMode({ isMobile, rowsCount, simplified }: { isMobile: boolean; rowsCount: number; simplified: boolean }): boolean {
  return Boolean(isMobile && rowsCount > BIG_FILE_MOBILE_THRESHOLD && !simplified)
}
