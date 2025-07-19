'use client'

import React, { useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'

interface ImageSearchProps {
  searchQuery: string
  tagQuery: string
  onSearchChange: (query: string) => void
  onTagChange: (tags: string) => void
  showTagSearch?: boolean
  placeholder?: string
  tagPlaceholder?: string
  className?: string
}

export function ImageSearch({
  searchQuery,
  tagQuery,
  onSearchChange,
  onTagChange,
  showTagSearch = true,
  placeholder = "Search images...",
  tagPlaceholder = "Tag (comma separated)...",
  className = ''
}: ImageSearchProps) {
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery)
  const [localTagQuery, setLocalTagQuery] = useState(tagQuery)

  // Debounce search query changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (localSearchQuery !== searchQuery) {
        onSearchChange(localSearchQuery)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [localSearchQuery, searchQuery, onSearchChange])

  // Debounce tag query changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (localTagQuery !== tagQuery) {
        onTagChange(localTagQuery)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [localTagQuery, tagQuery, onTagChange])

  // Sync local state with props
  useEffect(() => {
    setLocalSearchQuery(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    setLocalTagQuery(tagQuery)
  }, [tagQuery])

  return (
    <div className={`flex items-center space-x-4 ${className}`}>
      {/* Text Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder={placeholder}
          value={localSearchQuery}
          onChange={(e) => setLocalSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Tag Search */}
      {showTagSearch && (
        <div className="relative max-w-xs">
          <input
            type="text"
            placeholder={tagPlaceholder}
            value={localTagQuery}
            onChange={(e) => setLocalTagQuery(e.target.value)}
            className="w-full pl-3 pr-8 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          {localTagQuery && (
            <button
              type="button"
              onClick={() => setLocalTagQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700 text-xs"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
} 