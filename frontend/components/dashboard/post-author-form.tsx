'use client'

import { PostAuthorForm as CommonPostAuthorForm } from '../common/post-author-form'

interface PostAuthorFormProps {
  userId?: string
  onPostCreated?: () => void
  defaultFeedTarget?: {
    id: string
    name: string
    type: 'PERSONAL' | 'GROUP'
    isDefault?: boolean
  }
  allowLockedPosts?: boolean
  availableGroupFeeds?: Array<{
    id: string
    name: string
    type: 'PERSONAL' | 'GROUP'
    isDefault?: boolean
  }>
  showPersonalFeedOption?: boolean
}

export function PostAuthorForm({ 
  userId, 
  onPostCreated,
  defaultFeedTarget,
  allowLockedPosts = true,
  availableGroupFeeds,
  showPersonalFeedOption
}: PostAuthorFormProps) {
  return (
    <CommonPostAuthorForm
      userId={userId}
      onPostCreated={onPostCreated}
      allowLockedPosts={allowLockedPosts}
      defaultFeedTarget={defaultFeedTarget}
      availableGroupFeeds={availableGroupFeeds}
      showPersonalFeedOption={showPersonalFeedOption}
    />
  )
} 