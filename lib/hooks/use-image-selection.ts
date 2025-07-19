import { useState, useCallback } from 'react'

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

interface UseImageSelectionOptions {
  maxSelection?: number
  allowMultiple?: boolean
}

export function useImageSelection(
  initialSelection: Image[] = [],
  options: UseImageSelectionOptions = {}
) {
  const { maxSelection, allowMultiple = true } = options
  const [selectedImages, setSelectedImages] = useState<Image[]>(initialSelection)

  const toggleImage = useCallback((image: Image) => {
    setSelectedImages(prev => {
      const isSelected = prev.some(img => img.id === image.id)
      
      if (isSelected) {
        // Remove image
        return prev.filter(img => img.id !== image.id)
      } else {
        // Add image
        if (!allowMultiple) {
          return [image]
        }
        
        if (maxSelection && prev.length >= maxSelection) {
          // Remove oldest selection if at max
          return [...prev.slice(1), image]
        }
        
        return [...prev, image]
      }
    })
  }, [allowMultiple, maxSelection])

  const selectImage = useCallback((image: Image) => {
    setSelectedImages(prev => {
      const isSelected = prev.some(img => img.id === image.id)
      if (!isSelected) {
        if (!allowMultiple) {
          return [image]
        }
        
        if (maxSelection && prev.length >= maxSelection) {
          return [...prev.slice(1), image]
        }
        
        return [...prev, image]
      }
      return prev
    })
  }, [allowMultiple, maxSelection])

  const deselectImage = useCallback((imageId: string) => {
    setSelectedImages(prev => prev.filter(img => img.id !== imageId))
  }, [])

  const selectImages = useCallback((images: Image[]) => {
    if (!allowMultiple) {
      setSelectedImages(images.slice(0, 1))
      return
    }
    
    if (maxSelection) {
      setSelectedImages(images.slice(0, maxSelection))
    } else {
      setSelectedImages(images)
    }
  }, [allowMultiple, maxSelection])

  const clearSelection = useCallback(() => {
    setSelectedImages([])
  }, [])

  const isSelected = useCallback((imageId: string) => {
    return selectedImages.some(img => img.id === imageId)
  }, [selectedImages])

  const getSelectedCount = useCallback(() => {
    return selectedImages.length
  }, [selectedImages])

  const canSelectMore = useCallback(() => {
    if (!maxSelection) return true
    return selectedImages.length < maxSelection
  }, [selectedImages.length, maxSelection])

  return {
    selectedImages,
    toggleImage,
    selectImage,
    deselectImage,
    selectImages,
    clearSelection,
    isSelected,
    getSelectedCount,
    canSelectMore,
    setSelectedImages
  }
} 