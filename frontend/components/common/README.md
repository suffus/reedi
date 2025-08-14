# Enhanced Post Author Form

The `PostAuthorForm` component has been enhanced to support multiple feed targets, making it suitable for both personal and group contexts.

## Features

- **Multiple Feed Targets**: Post to multiple feeds simultaneously
- **Group Support**: Post to group feeds with proper API endpoints
- **Locked Posts**: Support for locked posts with unlock pricing
- **Personal Feed Option**: Option to also post to personal feed when posting to groups
- **Feed Selection**: Visual selection of additional feed targets
- **Consistent Styling**: Follows Reedi's Neem London aesthetic

## Props

```typescript
interface PostAuthorFormProps {
  userId?: string
  onPostCreated?: () => void
  defaultFeedTarget?: FeedTarget
  allowLockedPosts?: boolean
  availableGroupFeeds?: FeedTarget[]
  showPersonalFeedOption?: boolean
}

interface FeedTarget {
  id: string
  name: string
  type: 'PERSONAL' | 'GROUP'
  isDefault?: boolean
}
```

## Usage Examples

### Basic Personal Feed Usage

```tsx
import { PostAuthorForm } from '../common/post-author-form'

function PersonalFeed() {
  return (
    <PostAuthorForm
      onPostCreated={() => console.log('Post created!')}
      allowLockedPosts={true}
    />
  )
}
```

### Group Feed Usage

```tsx
import { PostAuthorForm } from '../common/post-author-form'

function GroupFeed({ groupId, groupName }) {
  const defaultFeedTarget = {
    id: groupId,
    name: groupName,
    type: 'GROUP' as const,
    isDefault: true
  }

  const availableGroupFeeds = [
    { id: 'group1', name: 'Tech Enthusiasts', type: 'GROUP' as const },
    { id: 'group2', name: 'Design Community', type: 'GROUP' as const }
  ]

  return (
    <PostAuthorForm
      onPostCreated={() => console.log('Post created in group!')}
      defaultFeedTarget={defaultFeedTarget}
      allowLockedPosts={true}
      availableGroupFeeds={availableGroupFeeds}
      showPersonalFeedOption={true}
    />
  )
}
```

### Using the GroupPostForm Helper

```tsx
import { GroupPostForm } from '../common/group-post-form'

function GroupPage({ groupId, groupName }) {
  const availableGroupFeeds = [
    { id: 'group1', name: 'Tech Enthusiasts', type: 'GROUP' as const },
    { id: 'group2', name: 'Design Community', type: 'GROUP' as const }
  ]

  return (
    <GroupPostForm
      groupId={groupId}
      groupName={groupName}
      onPostCreated={() => console.log('Post created!')}
      availableGroupFeeds={availableGroupFeeds}
    />
  )
}
```

## API Integration

The component automatically handles posting to different endpoints:

- **Personal Feed**: `POST /api/posts`
- **Group Feed**: `POST /api/groups/:groupId/posts`

## Feed Target Selection

Users can select up to 3 additional group feeds (excluding the default feed) and optionally include their personal feed. The component provides:

- Visual feed selection with icons
- Feed type indicators (Personal/Group)
- Selection state management
- Feed summary display

## Locked Posts

When `allowLockedPosts` is true, users can:

- Toggle locked post mode
- Set unlock price in tokens
- Select which media items to lock
- Preview locked post settings

## Styling

The component follows Reedi's design system:

- Olive green color scheme
- Square/rounded-sm corners
- Consistent typography
- Proper spacing and shadows
- Responsive grid layouts

## State Management

The component manages:

- Selected feed targets
- Post content and visibility
- Locked post settings
- Media selection
- Form submission state

## Error Handling

- Validates feed selection before submission
- Handles API errors gracefully
- Provides user feedback
- Resets form state on success 