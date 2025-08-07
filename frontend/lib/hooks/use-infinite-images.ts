import { useState, useEffect, useCallback } from 'react'

interface Image {
  id: string
  url: string
  thumbnail: string | null
  altText: string | null
  caption: string | null
  tags: string[]
  createdAt: string
  author?: {
    id: string
    name: string
    username: string
    avatar: string | null
  }
}

interface ImageData {
  images: Image[]
  pagination: {
    total: number
    hasNext: boolean
    currentPage: number
  }
}

interface UseInfiniteImagesOptions {
  initialPage?: number
  pageSize?: number
}

export function useInfiniteImages(
  fetchFunction: (page: number, pageSize: number) => Promise<ImageData>,
  dependencies: any[] = [],
  options: UseInfiniteImagesOptions = {}
) {
  const { initialPage = 1, pageSize = 20 } = options
  
  const [allImages, setAllImages] = useState<Image[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [totalImages, setTotalImages] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadImages = useCallback(async (page: number, isInitial = false) => {
    try {
      if (isInitial) {
        setIsLoading(true)
      } else {
        setIsLoadingMore(true)
      }
      setError(null)

      const data = await fetchFunction(page, pageSize)
      const newImages = data.images || []
      const pagination = data.pagination

      if (page === initialPage) {
        // First page - replace all images
        setAllImages(newImages)
      } else {
        // Subsequent pages - append new images, avoiding duplicates
        setAllImages(prev => {
          const existingIds = new Set(prev.map(img => img.id))
          const uniqueNewImages = newImages.filter(img => !existingIds.has(img.id))
          return [...prev, ...uniqueNewImages]
        })
      }

      setTotalImages(pagination?.total || 0)
      setHasMore(pagination?.hasNext || false)
      setCurrentPage(page)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load images')
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [fetchFunction, pageSize, initialPage])

  const loadMore = useCallback(() => {
    if (hasMore && !isLoading && !isLoadingMore) {
      loadImages(currentPage + 1, false)
    }
  }, [hasMore, isLoading, isLoadingMore, currentPage, loadImages])

  const reset = useCallback(() => {
    setAllImages([])
    setHasMore(true)
    setCurrentPage(initialPage)
    setTotalImages(0)
    setIsLoading(false)
    setIsLoadingMore(false)
    setError(null)
  }, [initialPage])

  const refresh = useCallback(() => {
    reset()
    loadImages(initialPage, true)
  }, [reset, loadImages, initialPage])

  // Load initial data
  useEffect(() => {
    loadImages(initialPage, true)
  }, [loadImages, initialPage])

  // Reload when dependencies change
  useEffect(() => {
    if (dependencies.length > 0) {
      refresh()
    }
  }, dependencies)

  return {
    images: allImages,
    hasMore,
    isLoading: isLoading && currentPage === initialPage,
    isLoadingMore,
    error,
    totalImages,
    currentPage,
    loadMore,
    reset,
    refresh
  }
} 