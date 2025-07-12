Implementation Strategy
1. Database Schema Updates
The current schema already supports the relationship between posts and images (Image model has postId field), so no schema changes are needed. However, we'll need to:
Update the post creation/update API to handle image associations
Ensure tags from posts are propagated to associated images
2. Backend API Enhancements
Post Creation/Update Endpoints
Modify /posts POST endpoint to accept imageIds array
Modify /posts/:id PUT endpoint to handle image associations
Add logic to:
Link selected images to the post
Apply post hashtags to all associated images
Update image metadata (title, description) if provided
New Image Selection Endpoint
Create /posts/:id/images endpoint for managing post images
Support both adding new images and selecting from existing gallery
Handle bulk operations for multiple images
3. Frontend Components
Enhanced Post Creation Form
Add image selection button next to existing ImageIcon and Tag buttons
Show selected images preview in the post form
Allow reordering of images (first image becomes main display)
Show image count and allow removal of individual images
Image Selector Modal
Create a new modal component with two tabs:
Upload New Images: Reuse existing ImageUploader component
Select from Gallery: Grid view of user's existing images with:
Multi-selection checkboxes
Search/filter functionality
Pagination for large galleries
Preview of selected images
Post Display Enhancements
Single Image: Display as main image
Multiple Images:
Show first image as main (larger)
Show remaining images as thumbnails below or beside (responsive layout)
Click to expand/view all images
Maintain aspect ratio considerations
4. User Experience Flow
Adding Images to Post
User clicks image icon in post creation form
Modal opens with two tabs: "Upload New" and "Select from Gallery"
Upload New:
Use existing uploader with shared metadata
Images automatically added to both post and user gallery
Select from Gallery:
Browse existing images with multi-select
Selected images are linked to post (not duplicated)
Post hashtags are applied to selected images
Post Display Logic
1 Image: Full-width display
2-3 Images: Side-by-side grid
4+ Images: Main image + thumbnail strip below
Responsive: Adapt layout based on screen size and image aspect ratios
5. Technical Implementation Details
API Hooks
usePostImages - Get images for a specific post
useAddImagesToPost - Add images to existing post
useSelectGalleryImages - Get user's gallery for selection
State Management
Track selected images in post creation form
Handle image ordering (first image = main display)
Manage upload progress and gallery selection state
Image Processing
Ensure thumbnails are generated for post display
Handle different aspect ratios gracefully
Optimize loading with lazy loading for multiple images
Tag Propagation
When post is created/updated, apply post hashtags to all associated images
Allow individual image tags to be preserved
Merge post tags with existing image tags
6. UI/UX Considerations
Visual Design
Consistent with existing neemlondon.com aesthetic
Smooth transitions between upload and gallery selection
Clear visual feedback for selected images
Responsive grid layouts for different screen sizes
Performance
Lazy load gallery images in selector
Optimize thumbnail generation
Implement virtual scrolling for large galleries
Cache frequently accessed images
Accessibility
Keyboard navigation for image selection
Screen reader support for image descriptions
Alt text management for post images
7. Data Flow
Post Creation: User selects images → Images uploaded/linked → Post created with image associations
Post Display: Load post → Load associated images → Render with appropriate layout
Tag Sync: Post hashtags → Applied to all associated images → Images updated in gallery
This implementation provides a seamless workflow for adding images to posts while maintaining the existing gallery functionality and ensuring proper data relationships between posts, images, and tags.