'use client'

import React, { useRef, useEffect, useCallback, ReactNode } from 'react'

interface InfiniteScrollContainerProps {
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void
  children: ReactNode
  threshold?: number
  className?: string
}

export function InfiniteScrollContainer({
  hasMore,
  isLoading,
  onLoadMore,
  children,
  threshold = 0.1,
  className = ''
}: InfiniteScrollContainerProps) {
  const endRef = useRef<HTMLDivElement>(null)

  const handleScroll = useCallback(() => {
    if (hasMore && !isLoading) {
      onLoadMore()
    }
  }, [hasMore, isLoading, onLoadMore])

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleScroll()
        }
      },
      { threshold }
    )

    if (endRef.current) {
      observer.observe(endRef.current)
    }

    return () => {
      observer.disconnect()
    }
  }, [handleScroll, threshold])

  return (
    <div className={className}>
      {children}
      
      {/* Infinite scroll trigger */}
      {hasMore && (
        <div ref={endRef} className="flex justify-center pt-4">
          {isLoading && (
            <div className="flex items-center space-x-2 text-gray-500">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              <span>Loading more images...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 