# Mobile Media Viewer Specification

## Overview

This document specifies the behavior and layout of the media viewer on mobile devices, with particular focus on portrait-oriented viewports. The mobile viewer provides an optimized experience for viewing images and videos on phones while maintaining access to metadata, comments, and interaction controls.

## Viewport Detection

### Orientation Detection

The media viewer shall detect viewport orientation using the following criteria:

- **Portrait Mode**: Viewport height > viewport width
- **Landscape Mode**: Viewport width >= viewport height

### Responsive Breakpoints

The mobile-optimized layout activates when:
- Viewport width < 768px (mobile breakpoint)
- OR portrait orientation is detected on any touch-enabled device

The viewer shall re-evaluate orientation on:
- Window resize events
- Device orientation change events
- Screen rotation

## Layout Architecture

### Desktop Layout (Reference)
- Media displayed in center column
- Metadata sidebar on right
- Comments sidebar on right below metadata
- Controls overlay on media

### Mobile Portrait Layout

#### Top Section - Header Controls
- Fixed position at top of viewport
- Semi-transparent dark background (rgba(0,0,0,0.7))
- Height: 56px
- Contains:
  - Close/Back button (left)
  - Media title (center, truncated with ellipsis)
  - More options menu (right)
  - Download button (if permitted)
  - Share button

#### Media Section
- Follows header immediately below
- Full viewport width (100vw)
- Height calculated to fit common aspect ratios
- Background: Black (#000000)
- Contains:
  - The image or video element
  - Zoom/pan controls (for images)
  - Play/pause controls (for videos)
  - Fullscreen toggle button (bottom-right)

#### Metadata Section
- Below media, full width
- Collapsible accordion style
- Default: Expanded showing summary info
- Background: White
- Padding: 16px horizontal, 12px vertical
- Contains:
  - Uploader name and avatar
  - Upload date/time
  - View count
  - Like/favorite buttons
  - Caption/description
  - Tags (horizontally scrollable if many)
  - Location (if available)
  - Expand/collapse toggle

#### Comments Section
- Below metadata section
- Full width, scrolls with page
- Background: White
- Contains:
  - Comment count header
  - Comment input field (sticky at top of comments section)
  - Comment thread list
  - Load more button (if pagination needed)

### Mobile Landscape Layout

When mobile device is in landscape orientation:
- Header controls remain at top (44px height for more screen space)
- Media takes full viewport width and available height
- Metadata and comments become a slide-up drawer accessible via button
- Drawer slides from bottom, covers lower 60% of screen
- Drawer can be dismissed by swiping down or tapping outside

## Image Viewer Behavior

### Default Display State

**Initial Render:**
- Image is fitted to viewport width
- Maintains aspect ratio
- Centered vertically in media section
- No letterboxing on sides
- Max height: 60vh in portrait mode (to show content below)
- If image height exceeds max height, it's scaled down maintaining aspect ratio

**Fit Modes:**
The viewer supports three fit modes, switchable via button:
1. **Fit Width** (default) - Image width = 100vw, height scales proportionally
2. **Fit Screen** - Image scaled to fit within available media section height and width
3. **Actual Size** - Image displayed at 1:1 pixel ratio (may require scrolling)

### Zoom and Pan Controls

#### Pinch Zoom
- Two-finger pinch gesture zooms in/out
- Zoom range: 1x to 5x of current fit mode
- Zoom centers on midpoint between fingers
- Smooth animation with momentum

#### Double Tap Zoom
- Double tap zooms to 2x at tap point
- If already zoomed, double tap returns to fit mode
- Smooth animation (300ms duration)

#### Zoom Controls (Visual)
- Zoom in button (+)
- Zoom out button (-)
- Reset zoom button (1:1 or fit icon)
- Positioned in bottom-left corner
- Semi-transparent background
- Fade out after 2 seconds of inactivity
- Reappear on touch/interaction

#### Pan Behavior
- When zoomed beyond fit mode, image becomes pannable
- Single finger drag pans the image
- Pan bounds limited to image edges (rubber-band effect at limits)
- Momentum scrolling enabled
- Page scroll disabled when image is zoomed

#### Orientation Lock
- When zoomed or in fullscreen, prevent page scrolling
- Restore scroll when returning to fit mode

### Progressive Loading

**Thumbnail Phase:**
- Load and display thumbnail immediately
- Apply blur placeholder effect

**Full Resolution:**
- Load full resolution in background
- Fade transition from thumbnail to full (200ms)
- Show loading indicator for large images (>2MB)

**Very Large Images:**
- For images >5000px on any dimension
- Load optimized/downscaled version first
- Allow opt-in to full resolution via button
- Show "View full resolution" button in controls

## Video Viewer Behavior

### Default Display State

**Initial Render:**
- Video element at full viewport width
- Height determined by video aspect ratio
- Black background fills any letterbox space
- Poster image shown before play
- Max height: 60vh in portrait mode

### Playback Controls

#### Standard Controls (Portrait)
- Large play/pause button (centered overlay, fades after play starts)
- Progress bar with scrubber (bottom of video)
- Current time / duration display
- Volume control (slider)
- Quality selector (if multiple qualities available)
- Fullscreen button
- Picture-in-picture button (if supported)

#### Control Visibility
- Controls visible by default when paused
- Controls fade after 3 seconds of playback
- Single tap on video shows/hides controls
- Controls always visible when scrubbing or interacting

#### Mobile-Specific Optimizations
- Larger touch targets (minimum 44x44px)
- Progress bar height: 8px (12px when touched)
- Volume control appears as overlay popup when tapped
- Quality selector appears as bottom sheet menu

### Autoplay Behavior
- Do not autoplay by default
- If navigated from gallery with autoplay intent, play muted initially
- Show unmute button prominently
- Respect user's reduced motion preferences

### Video Fit Modes
1. **Fit Width** (default) - Video width = 100vw
2. **Fit Screen** - Video scaled to fit media section
3. **Fill** - Video scaled to fill media section, cropping if needed (for vertical videos)

## Fullscreen/Immersive Mode

### Activation
User can enter fullscreen mode via:
- Fullscreen button on media viewer
- Pinch out gesture beyond 100% on images
- Swipe up on video during playback

### Fullscreen Behavior (Images)

**Layout:**
- Status bar hidden (where OS permits)
- Header controls hidden
- Media fills entire viewport (100vh × 100vw)
- Background: Pure black
- All metadata and comments hidden

**Controls:**
- Single tap shows minimal overlay controls
- Controls include:
  - Close fullscreen button (top-left, X icon)
  - Zoom level indicator (if zoomed)
  - Fullscreen zoom controls (bottom-left)
- Controls fade after 2 seconds
- Swipe down gesture exits fullscreen

**Zoom in Fullscreen:**
- All zoom/pan behaviors remain functional
- No max-height constraints
- Image can zoom to 5x original size
- Pan freely across entire image

### Fullscreen Behavior (Videos)

**Layout:**
- Native browser fullscreen API utilized
- Video scaled to fit screen optimally
- Maintains aspect ratio
- Black background for letterboxing

**Controls:**
- Standard video controls remain available
- Minimal overlay design
- Back/exit button in top-left
- Swipe down or back button exits fullscreen

**Landscape Optimization:**
- When entering fullscreen, suggest landscape via UI hint (if in portrait)
- If device rotates to landscape, video fills screen width
- If video is vertical (aspect ratio < 1), keep portrait optimized

## Navigation and Gestures

### Swipe Gestures

**Horizontal Swipes (on media, not zoomed):**
- Swipe left: Next media item (if in gallery context)
- Swipe right: Previous media item (if in gallery context)
- Threshold: 30% of screen width or fast swipe (>0.5px/ms)
- Visual feedback: Media slides with finger, rubber-bands if at bounds

**Vertical Swipes:**
- Swipe down (on media, from top): Close viewer and return to gallery
- Swipe up (on comments): Scroll comments section
- Swipe down (in fullscreen): Exit fullscreen mode

**Swipe Conflict Resolution:**
- When image is zoomed and pannable, swipes pan the image only
- When image is at left/right edge of pan bounds, swipes navigate gallery
- Diagonal swipes favor the axis with greater movement

### Button Navigation

**Header:**
- Back button: Returns to previous view (gallery or post)
- Close button (in fullscreen): Exits fullscreen

**Media Navigation Arrows:**
- Display as overlay on left/right edges in gallery context
- Translucent chevrons
- Only visible when not zoomed
- Hidden in fullscreen

## Performance Considerations

### Image Optimization
- Request appropriately sized images based on viewport
- Use responsive images with srcset for different densities
- Request 2x DPR images for high-DPI displays
- Cache aggressively with service worker

### Video Optimization
- Use adaptive streaming (HLS/DASH) when available
- Start with lower quality, upgrade if bandwidth permits
- Preload="metadata" for faster preview
- Implement quality selector for user override

### Lazy Loading
- Preload next/previous media in gallery context
- Limit preload to ±1 position
- Cancel preloads when user navigates away

### Animation Performance
- Use CSS transforms (translate, scale) for smooth 60fps
- Utilize hardware acceleration (transform3d)
- Debounce resize events (150ms)
- Use requestAnimationFrame for gesture tracking

## Accessibility

### Touch Targets
- Minimum touch target size: 44×44px
- Adequate spacing between interactive elements: 8px minimum

### Screen Reader Support
- Announce media type on load
- Announce zoom level changes
- Announce navigation position in gallery (e.g., "3 of 12")
- Provide text alternatives for all icon buttons
- Make all controls keyboard accessible for external keyboard users

### Reduced Motion
- Respect prefers-reduced-motion media query
- Disable parallax effects and momentum scrolling
- Reduce animation durations to <100ms
- Maintain zoom functionality but remove spring animations

### High Contrast
- Ensure controls visible in high contrast mode
- Provide sufficient contrast for overlaid text and icons
- Use borders in addition to color for control states

### Focus Management
- Trap focus within fullscreen mode
- Return focus to trigger element on exit
- Visible focus indicators for keyboard navigation

## Edge Cases and Error Handling

### Network Issues

**Slow Loading:**
- Show loading spinner after 1 second
- Show progress bar for images >500KB
- Display "Slow connection" message after 5 seconds
- Provide "Cancel and retry" option after 10 seconds

**Load Failure:**
- Display error state with descriptive message
- Show retry button
- Option to view in browser (external link)
- Fallback to thumbnail if available

**During Zoom/Pan:**
- If high-res version fails, stay on current quality
- Allow user to continue with lower quality
- Show dismissible warning toast

### Unsupported Media

**Format Not Supported:**
- Detect via error event on media element
- Display format name and "not supported" message
- Offer download option
- Link to help documentation

**DRM/Protected Content:**
- Handle DRM errors gracefully
- Explain authentication/subscription requirements
- Provide clear path to authorize

### Orientation Change

**During Viewing:**
- Smoothly transition layouts (300ms animation)
- Maintain zoom level and pan position if possible
- Reset to fit mode if zoomed view doesn't make sense in new orientation

**During Fullscreen:**
- Maintain fullscreen mode
- Re-calculate fit based on new dimensions
- Keep video playing without interruption

### Memory Management

**Large Images:**
- Monitor memory usage if API available
- Unload offscreen gallery images
- Limit simultaneous high-res images to 3
- Clear canvas/blob caches when exiting viewer

**Video Buffering:**
- Limit buffer size on mobile (30 seconds max)
- Release video element resources when navigating away
- Pause video when app backgrounded

## Implementation Notes

### Technology Recommendations

**Touch Event Handling:**
- Use Pointer Events API for unified touch/mouse/pen
- Fallback to Touch Events for older browsers
- Implement gesture recognition library (e.g., Hammer.js) or custom

**Image Zoom:**
- Consider existing libraries: react-pinch-zoom-pan, react-easy-zoom
- Or implement with CSS transforms and pointer events
- Use transform-origin for natural zoom center

**Video Player:**
- Use native <video> element with custom controls
- Consider Video.js or Plyr for advanced features
- Ensure iOS inline playback with playsinline attribute

**Fullscreen:**
- Use Fullscreen API with vendor prefixes
- Fallback to pseudo-fullscreen (fixed positioning) on iOS Safari
- Handle iOS notch/safe areas with env(safe-area-inset-*)

### State Management

Track these states for proper rendering:
- `viewport`: { width, height, orientation }
- `mediaFitMode`: 'fit-width' | 'fit-screen' | 'actual-size'
- `zoomLevel`: number (1.0 to 5.0)
- `panPosition`: { x, y }
- `isFullscreen`: boolean
- `controlsVisible`: boolean
- `isPlaying`: boolean (for videos)
- `currentTime`: number (for videos)
- `metadataExpanded`: boolean

### Testing Scenarios

Must test on:
- iPhone SE (small portrait)
- iPhone 14 Pro (portrait with notch)
- iPhone 14 Pro Max (large portrait)
- iPad Mini (portrait and landscape)
- Android phones (various aspect ratios: 16:9, 18:9, 21:9)
- Foldable devices (both folded and unfolded)

Test cases:
1. Portrait to landscape rotation during zoom
2. Rapid pinch zoom in/out
3. Swipe navigation with momentum
4. Fullscreen with device rotation
5. Video playback with screen lock/unlock
6. Background/foreground transitions
7. Low memory scenarios
8. Slow network conditions (throttle to 3G)
9. Very tall images (>10000px height)
10. Very wide panoramas (>10000px width)
11. Square images (1:1 aspect ratio)
12. Vertical videos (9:16 aspect ratio)
13. Screen reader navigation
14. External keyboard navigation

## Future Enhancements

Consider for future iterations:
- Multi-image comparison view (side-by-side)
- Image annotations/markup on mobile
- Offline viewing support
- Advanced video controls (playback speed, chapters)
- 360° photo viewing
- Live photo/motion photo support
- Deep zoom for extremely high-resolution images
- Collaborative viewing with shared annotations
- Picture-in-picture for videos when scrolling comments
- Haptic feedback for gesture boundaries
- Smart zoom to faces/subjects (using ML)

## Design Deliverables

The design team should provide:
1. Visual mockups for portrait and landscape layouts
2. Component specifications for all controls
3. Icon set for all buttons (at 1x, 2x, 3x)
4. Animation specifications (durations, easing functions)
5. Color values for all UI elements (including dark mode)
6. Typography specifications for all text elements
7. Touch target sizing and spacing grid
8. Gesture interaction flows
9. Error state visuals
10. Loading state animations

## Success Metrics

The mobile media viewer should achieve:
- Time to first paint: <300ms
- Time to interactive: <500ms
- Image load and display: <1s on 4G
- Smooth zoom/pan: 60fps maintained
- Gesture response latency: <16ms
- Zero layout shifts during orientation change
- Accessibility score: 100 (Lighthouse)
- User satisfaction: >4.5/5 in usability testing
- Bounce rate reduction: >30% vs. current implementation
- Average session time increase: >50% on mobile


# Implementation Schedule

Rather than modify the existing media detail viewer(s) for desktop display (which work quite well), we should create new components for the mobile experience and use them when we detect that the view mode is portrait.

## Stage 1 - initial deployment.

1.  Implement a mobile-image-detail and mobile-video-detail components for displaying images and videos repectively.
2.  Reuse the common media-metadat-panel as far as possible to avoid duplication.
3.  Use the design specification in the design spec document.
4.  Link in the new components when portrait mode is detected.