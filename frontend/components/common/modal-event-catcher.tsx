'use client'

import React, { useEffect, useRef } from 'react'

interface ModalEventCatcherProps {
  children: React.ReactNode
  onEscape?: () => void
  onBackdropClick?: () => void
  allowScroll?: boolean // Allow wheel events to propagate
  allowKeys?: string[] // Array of key codes to allow through
  onCustomKeyDown?: (event: KeyboardEvent) => void // Custom keyboard handler
  className?: string
  style?: React.CSSProperties
}

export function ModalEventCatcher({
  children,
  onEscape,
  onBackdropClick,
  allowScroll = false,
  allowKeys = [],
  onCustomKeyDown,
  className = '',
  style = {}
}: ModalEventCatcherProps) {
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Allow specific keys to pass through
      if (allowKeys.includes(event.key) || allowKeys.includes(event.code)) {
        // Call custom handler for allowed keys
        if (onCustomKeyDown) {
          onCustomKeyDown(event)
        }
        return
      }

      // Handle escape key
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault()
        event.stopPropagation()
        onEscape()
        return
      }

      // Stop all other key events
      event.preventDefault()
      event.stopPropagation()
    }

    const handleWheel = (event: WheelEvent) => {
      //if (!allowScroll) {
        //event.preventDefault()
        //event.preventDefault()
        event.stopPropagation()
      //}
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (!allowScroll) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    const handleContextMenu = (event: MouseEvent) => {
      // Prevent right-click context menu
      event.preventDefault()
      event.stopPropagation()
    }

    const handleBackdropClick = (event: MouseEvent) => {
      // Only trigger if clicking the backdrop itself, not its children
      if (event.target === backdropRef.current && onBackdropClick) {
        onBackdropClick()
      }
    }

    // Add event listeners to the backdrop element
    const backdrop = backdropRef.current
    if (backdrop) {
      backdrop.addEventListener('keydown', handleKeyDown)
      backdrop.addEventListener('wheel', handleWheel)
      backdrop.addEventListener('touchmove', handleTouchMove, { passive: false })
      backdrop.addEventListener('contextmenu', handleContextMenu)
      backdrop.addEventListener('click', handleBackdropClick)

      // Focus the backdrop to capture keyboard events
      backdrop.focus()
    }

    // Cleanup
    return () => {
      if (backdrop) {
        backdrop.removeEventListener('keydown', handleKeyDown)
        backdrop.removeEventListener('wheel', handleWheel)
        backdrop.removeEventListener('touchmove', handleTouchMove)
        backdrop.removeEventListener('contextmenu', handleContextMenu)
        backdrop.removeEventListener('click', handleBackdropClick)
      }
    }
  }, [onEscape, onBackdropClick, allowScroll, allowKeys, onCustomKeyDown])


  return (
    <div
      ref={backdropRef}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 ${className}`}
      style={{
        ...style,
        // Ensure the backdrop can receive focus for keyboard events
        outline: 'none'
      }}
      tabIndex={-1} // Make it focusable but not in tab order
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  )
}

// Higher-order component for easy wrapping
export function withModalEventCatcher<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<ModalEventCatcherProps, 'children'> = {}
) {
  return function WrappedComponent(props: P) {
    return (
      <ModalEventCatcher {...options}>
        <Component {...props} />
      </ModalEventCatcher>
    )
  }
}

// Hook for manual event catching (if you need more control)
export function useModalEventCatcher(options: {
  onEscape?: () => void
  allowScroll?: boolean
  allowKeys?: string[]
} = {}) {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (options.allowKeys?.includes(event.key) || options.allowKeys?.includes(event.code)) {
      return
    }

    if (event.key === 'Escape' && options.onEscape) {
      event.preventDefault()
      event.stopPropagation()
      options.onEscape()
      return
    }

    event.preventDefault()
    event.stopPropagation()
  }

  const handleWheel = (event: React.WheelEvent) => {
    if (!options.allowScroll) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  return {
    onKeyDown: handleKeyDown,
    onWheel: handleWheel,
    tabIndex: -1
  }
} 