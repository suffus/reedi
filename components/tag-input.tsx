'use client'

import React, { useState, useCallback } from 'react'
import { X, Plus, Tag } from 'lucide-react'

interface TagInputProps {
  tags: string[]
  onTagsChange: (tags: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  maxTags?: number
}

export function TagInput({
  tags,
  onTagsChange,
  placeholder = "Enter tags (comma-separated)",
  disabled = false,
  className = "",
  maxTags
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')

  const addTags = useCallback((newTags: string[]) => {
    if (disabled) return

    // Filter out empty tags and trim whitespace
    const validTags = newTags
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)

    if (validTags.length === 0) return

    // Remove duplicates and add new tags
    const existingTags = new Set(tags)
    const uniqueNewTags = validTags.filter(tag => !existingTags.has(tag))

    if (uniqueNewTags.length === 0) return

    // Check max tags limit
    if (maxTags && tags.length + uniqueNewTags.length > maxTags) {
      const remainingSlots = maxTags - tags.length
      const tagsToAdd = uniqueNewTags.slice(0, remainingSlots)
      onTagsChange([...tags, ...tagsToAdd])
    } else {
      onTagsChange([...tags, ...uniqueNewTags])
    }

    // Clear input after adding tags
    setInputValue('')
  }, [tags, onTagsChange, disabled, maxTags])

  const removeTag = useCallback((tagToRemove: string) => {
    if (disabled) return
    onTagsChange(tags.filter(tag => tag !== tagToRemove))
  }, [tags, onTagsChange, disabled])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const newTags = inputValue.split(',').map(tag => tag.trim())
      addTags(newTags)
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      // Remove last tag when backspace is pressed on empty input
      removeTag(tags[tags.length - 1])
    }
  }, [inputValue, addTags, removeTag, tags])

  const handleAddClick = useCallback(() => {
    const newTags = inputValue.split(',').map(tag => tag.trim())
    addTags(newTags)
  }, [inputValue, addTags])

  const handleClearAll = useCallback(() => {
    if (disabled) return
    onTagsChange([])
  }, [onTagsChange, disabled])

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Input Section */}
      <div className="flex items-center space-x-2">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Tag className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>
        <button
          onClick={handleAddClick}
          disabled={disabled || !inputValue.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center space-x-1"
        >
          <Plus className="h-4 w-4" />
          <span>Add</span>
        </button>
      </div>

      {/* Tags Display */}
      {tags.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Tags ({tags.length}{maxTags ? `/${maxTags}` : ''})
            </span>
            {!disabled && (
              <button
                onClick={handleClearAll}
                className="text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors duration-200"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, index) => (
              <div
                key={`${tag}-${index}`}
                className="inline-flex items-center space-x-1 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium group hover:bg-blue-200 transition-colors duration-200"
              >
                <span>{tag}</span>
                {!disabled && (
                  <button
                    onClick={() => removeTag(tag)}
                    className="ml-1 text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded-full p-0.5 transition-colors duration-200"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Max Tags Warning */}
      {maxTags && tags.length >= maxTags && (
        <div className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
          Maximum number of tags reached ({maxTags})
        </div>
      )}
    </div>
  )
} 