'use client'

import { PostAuthorForm } from './post-author-form'

interface GroupPostFormProps {
  groupId: string
  groupName: string
  onPostCreated?: () => void
  availableGroupFeeds?: Array<{
    id: string
    name: string
    type: 'PERSONAL' | 'GROUP'
  }>
  allowLockedPosts?: boolean
}

export function GroupPostForm({ 
  groupId, 
  groupName, 
  onPostCreated,
  availableGroupFeeds = [],
  allowLockedPosts = true
}: GroupPostFormProps) {
  // Create the default feed target for this group
  const defaultFeedTarget = {
    id: groupId,
    name: groupName,
    type: 'GROUP' as const,
    isDefault: true
  }

  // Filter out the current group from available feeds
  const otherGroupFeeds = availableGroupFeeds.filter(feed => feed.id !== groupId)

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-semibold text-gray-900">Post to {groupName}</h3>
        <p className="text-sm text-gray-600">Share your thoughts with the group</p>
      </div>
      
      <PostAuthorForm
        onPostCreated={onPostCreated}
        defaultFeedTarget={defaultFeedTarget}
        allowLockedPosts={allowLockedPosts}
        availableGroupFeeds={otherGroupFeeds}
        showPersonalFeedOption={true}
      />
    </div>
  )
} 