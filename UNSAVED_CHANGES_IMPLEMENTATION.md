# Unsaved Changes Warning System Implementation

## Overview
This document describes the implementation of an unsaved changes warning system for the media detail viewer's metadata panel. The system prevents users from accidentally losing unsaved changes when closing the modal or navigating to other media items.

## Features

### 1. **Unsaved Changes Detection**
- Automatically detects when users have made changes to media metadata (title, description, tags)
- Compares current edit values with the last saved values
- Real-time tracking of unsaved state

### 2. **Warning Dialog**
- Shows a confirmation dialog when users try to leave with unsaved changes
- Provides three options:
  - **Save Changes**: Saves the current changes and proceeds with the action
  - **Discard**: Discards unsaved changes and proceeds with the action
  - **Cancel**: Cancels the action and returns to editing

### 3. **Protected Actions**
- **Modal Close**: Warns before closing the media detail modal
- **Navigation**: Warns before navigating to next/previous media item
- **Keyboard Shortcuts**: Protects against accidental navigation via keyboard

## Implementation Details

### Components Modified

#### 1. **MediaMetadataPanel** (`frontend/components/common/media-metadata-panel.tsx`)
- Added `forwardRef` and `useImperativeHandle` to expose functions to parent components
- Exposes:
  - `hasUnsavedChanges`: Boolean indicating if there are unsaved changes
  - `discardUnsavedChanges()`: Function to discard unsaved changes
  - `saveChanges()`: Function to save current changes
- Tracks changes by comparing edit values with local saved values

#### 2. **UnsavedChangesDialog** (`frontend/components/common/unsaved-changes-dialog.tsx`)
- New component for the confirmation dialog
- Clean, accessible design with clear action buttons
- High z-index to appear above modal content

#### 3. **ImageDetailModal** (`frontend/components/dashboard/image-detail-modal.tsx`)
- Added unsaved changes state management
- Wraps close and navigation actions with unsaved changes checks
- Integrates with the metadata panel through refs

#### 4. **VideoDetailModal** (`frontend/components/dashboard/video-detail-modal.tsx`)
- Same implementation as image modal
- Handles video-specific navigation through slideshow functionality

### State Management

```typescript
// Unsaved changes state
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
const metadataPanelRef = useRef<MediaMetadataPanelRef>(null)
```

### Key Functions

#### **checkUnsavedChanges(action)**
- Checks if there are unsaved changes before executing an action
- If changes exist, shows the warning dialog and stores the pending action
- If no changes, executes the action immediately

#### **handleSaveChanges()**
- Calls the metadata panel's save function
- Executes the pending action after successful save
- Handles save failures gracefully

#### **handleDiscardChanges()**
- Discards unsaved changes in the metadata panel
- Executes the pending action
- Cleans up dialog state

## User Experience Flow

### 1. **Normal Editing**
- User edits metadata (title, description, tags)
- Changes are tracked in real-time
- No warnings shown during normal editing

### 2. **Attempting to Leave with Changes**
- User tries to close modal or navigate
- System detects unsaved changes
- Warning dialog appears with three options

### 3. **User Choice**
- **Save**: Changes are saved, action proceeds
- **Discard**: Changes are lost, action proceeds
- **Cancel**: Returns to editing, no action taken

### 4. **After Action**
- If saved: User can continue editing or leave
- If discarded: User returns to clean state
- If cancelled: User continues editing

## Technical Implementation

### Ref Pattern
The system uses React refs to communicate between the modal and metadata panel:

```typescript
interface MediaMetadataPanelRef {
  discardUnsavedChanges: () => void
  saveChanges: () => Promise<void>
  hasUnsavedChanges: boolean
}
```

### Change Detection
Changes are detected by comparing current edit values with the last saved values:

```typescript
const hasUnsavedChanges = isEditing && (
  editTitle !== localTitle ||
  editDescription !== localDescription ||
  JSON.stringify(editTags) !== JSON.stringify(localTags)
)
```

### Action Wrapping
All protected actions are wrapped with the unsaved changes check:

```typescript
const handleClose = useCallback(() => {
  checkUnsavedChanges(() => {
    resetView()
    onClose()
  })
}, [resetView, onClose, hasUnsavedChanges])
```

## Benefits

### 1. **Data Protection**
- Prevents accidental loss of user work
- Gives users control over their changes
- Maintains data integrity

### 2. **User Experience**
- Clear feedback about unsaved state
- Intuitive action options
- Consistent behavior across all modals

### 3. **Developer Experience**
- Reusable components
- Clean separation of concerns
- Easy to maintain and extend

## Future Enhancements

### 1. **Auto-save**
- Implement automatic saving of changes
- Reduce the need for manual save actions
- Improve user workflow

### 2. **Change History**
- Track multiple versions of changes
- Allow users to revert to previous states
- Provide undo/redo functionality

### 3. **Bulk Operations**
- Handle unsaved changes across multiple media items
- Batch save operations
- Consistent behavior in gallery views

## Testing Considerations

### 1. **Edge Cases**
- Test with very long text inputs
- Verify behavior with special characters
- Test rapid navigation attempts

### 2. **Accessibility**
- Ensure keyboard navigation works
- Verify screen reader compatibility
- Test with different input methods

### 3. **Performance**
- Monitor impact on modal rendering
- Ensure change detection is efficient
- Test with large numbers of media items

## Conclusion

The unsaved changes warning system provides a robust, user-friendly way to protect user work while maintaining a smooth editing experience. The implementation is clean, maintainable, and follows React best practices. Users can now confidently edit media metadata without worrying about accidentally losing their changes.
