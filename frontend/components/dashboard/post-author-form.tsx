'use client'

import { PostAuthorForm as CommonPostAuthorForm } from '../common/post-author-form'

interface PostAuthorFormProps {
  userId?: string
  onPostCreated?: () => void
}

export function PostAuthorForm({ userId, onPostCreated }: PostAuthorFormProps) {
  return (
    <CommonPostAuthorForm
      userId={userId}
      onPostCreated={onPostCreated}
      allowLockedPosts={true}
    />
  )
} 