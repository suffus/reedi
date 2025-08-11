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

    const handleKeyDown = (event: React.KeyboardEvent) => {
      // Allow specific keys to pass through
      if (allowKeys.includes(event.key) || allowKeys.includes(event.code)) {
        // Call custom handler for allowed keys
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

    const handleWheel = (event: React.WheelEvent) => {
      //if (!allowScroll) {
        event.preventDefault()
        //event.preventDefault()
        event.stopPropagation()
      //}
    }

    const handleTouchMove = (event: React.TouchEvent) => {
      if (!allowScroll) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    const handleContextMenu = (event: React.MouseEvent) => {
      // Prevent right-click context menu
      event.preventDefault()
      event.stopPropagation()
    }

    const handleBackdropClick = (event: React.MouseEvent) => {
      // Only trigger if clicking the backdrop itself, not its children
    }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 ${className}`}
      style={{
        ...style,
        // Ensure the backdrop can receive focus for keyboard events
        outline: 'none'
      }}
      tabIndex={-1} // Make it focusable but not in tab order
      role="dialog"
      aria-modal="true"
      onWheel={handleWheel}
      onTouchMove={handleTouchMove}
      onContextMenu={handleContextMenu}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
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