import { useState, useEffect } from 'react'

interface ViewportInfo {
  isMobile: boolean
  isPortrait: boolean
  width: number
  height: number
}

/**
 * Hook to detect mobile viewport and orientation
 * 
 * Mobile is detected when:
 * - Viewport width < 768px (mobile breakpoint)
 * - OR portrait orientation is detected on any touch-enabled device
 * 
 * Portrait mode: viewport height > viewport width
 * Landscape mode: viewport width >= viewport height
 */
export function useMobileDetection(): ViewportInfo {
  const [viewportInfo, setViewportInfo] = useState<ViewportInfo>({
    isMobile: false,
    isPortrait: false,
    width: 0,
    height: 0
  })

  useEffect(() => {
    const updateViewportInfo = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const isPortrait = height > width
      
      // Mobile if width < 768px OR portrait orientation on touch device
      const isMobile = width < 768 || (isPortrait && isTouchDevice())
      
      setViewportInfo({
        isMobile,
        isPortrait,
        width,
        height
      })
    }

    // Check if device has touch capability
    function isTouchDevice(): boolean {
      return (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-ignore - legacy support
        (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0)
      )
    }

    // Initial check
    updateViewportInfo()

    // Listen for resize and orientation changes
    window.addEventListener('resize', updateViewportInfo)
    window.addEventListener('orientationchange', updateViewportInfo)
    
    return () => {
      window.removeEventListener('resize', updateViewportInfo)
      window.removeEventListener('orientationchange', updateViewportInfo)
    }
  }, [])

  return viewportInfo
}

/**
 * Simple hook that just returns if we're in mobile/portrait mode
 * Useful for components that only need to know mobile vs desktop
 */
export function useIsMobilePortrait(): boolean {
  const { isMobile, isPortrait } = useMobileDetection()
  return isMobile && isPortrait
}

