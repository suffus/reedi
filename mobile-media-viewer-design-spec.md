# Mobile Media Viewer - Design Specifications

## Visual Mockups Overview

This document provides detailed design specifications for the mobile media viewer, covering both portrait and landscape orientations. All measurements and specifications are designed to be consistent with the existing desktop viewer implementation.

---

## 1. Visual Mockups for Portrait and Landscape Layouts

### Portrait Mode Layout (Width < 768px)

```
┌─────────────────────────────────┐
│  [<]  Media Title...      [⋮][↓] │ ← Header (56px height)
├─────────────────────────────────┤
│                                 │
│                                 │
│         IMAGE/VIDEO             │ ← Media Section
│                                 │   (Full width, max 60vh)
│        [Zoom Controls]          │
│         [⛶ Fullscreen]          │
│                                 │
├─────────────────────────────────┤
│ 👤 Username      📅 2h ago      │
│ ❤️ 24  💬 5     ⭐ Favorite     │ ← Metadata Section
│                                 │   (Collapsible)
│ Caption text here...            │
│ #tag1 #tag2 #tag3 →→→→         │
│                          [˅]    │
├─────────────────────────────────┤
│ Comments (5)              [+]   │
│ ┌──────────────────────────────┤
│ │ 💬 Write a comment...        │ ← Sticky Comment Input
│ └──────────────────────────────┤
│                                 │
│ 👤 User1: Great photo!          │
│    2h ago  ↩️ Reply             │ ← Comments Section
│                                 │   (Scrolls with page)
│ 👤 User2: Amazing colors        │
│    1h ago  ↩️ Reply             │
│                                 │
└─────────────────────────────────┘
```

### Landscape Mode Layout (Mobile Landscape)

```
┌──────────────────────────────────────────────┐
│ [<] Title...           [⋮][↓]                │ ← Header (44px)
├──────────────────────────────────────────────┤
│                                              │
│                                              │
│              IMAGE/VIDEO                     │
│                                              │ ← Media fills screen
│         [Zoom]  [Nav]  [⛶]                   │
│                                              │
│                                              │
│                                    [📋 Show] │ ← Drawer trigger
└──────────────────────────────────────────────┘

When drawer is open (slides up from bottom):
┌──────────────────────────────────────────────┐
│ [<] Title...           [⋮][↓]                │
├──────────────────────────────────────────────┤
│              IMAGE/VIDEO                     │
│              (Visible in BG)                 │
├──────────────────────────────────────────────┤
│ ═══════════════════════════════════════ ↓    │ ← Drawer handle
│ 👤 Username  📅 Time  ❤️ 24  💬 5           │
│ Caption and metadata...                     │ ← 60% height drawer
│ ──────────────────────────────────────────  │
│ 💬 Comments...                              │
│ User comments here...                       │
└──────────────────────────────────────────────┘
```

### Fullscreen Mode (Portrait)

```
┌─────────────────────────────────┐
│                                 │
│                                 │
│                                 │
│                                 │
│              IMAGE              │
│         or VIDEO FULL           │ ← 100vh × 100vw
│                                 │   Pure black BG
│                                 │
│                                 │
│ [×]                    [Zoom]   │ ← Tap to show controls
│                                 │   (Fade after 2s)
└─────────────────────────────────┘
```

---

## 2. Component Specifications for All Controls

### Layout Variables (Consistent with Desktop)

```css
/* Core Spacing */
--mobile-header-height-portrait: 56px;
--mobile-header-height-landscape: 44px;
--mobile-sidebar-width: 0px; /* Hidden on mobile */
--desktop-sidebar-width: 450px; /* Reference */

/* Padding & Spacing */
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 12px;
--spacing-base: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;

/* Media Section */
--media-padding-portrait: 0px; /* Edge to edge */
--media-max-height-portrait: 60vh;
--media-max-height-landscape: calc(100vh - 44px);
--media-background: #000000;

/* Metadata Section */
--metadata-padding-h: 16px;
--metadata-padding-v: 12px;
--metadata-background: #FFFFFF;
--metadata-border: #E5E7EB;

/* Drawer (Landscape) */
--drawer-height: 60vh;
--drawer-handle-height: 4px;
--drawer-handle-width: 40px;
--drawer-background: #FFFFFF;
--drawer-backdrop: rgba(0, 0, 0, 0.4);

/* Touch Targets */
--touch-target-min: 44px;
--touch-target-spacing: 8px;
--button-icon-size: 20px;
```

### Header Bar Component

**Portrait Mode:**
```
Height: 56px
Position: fixed, top: 0, z-index: 50
Background: rgba(0, 0, 0, 0.7)
Backdrop-filter: blur(10px)
Padding: 8px 16px

Layout (Flexbox):
  [Back Button]  flex-1: [Title]  [Actions...]
  
  Back Button:
    - Size: 40×40px (tap target: 44×44px)
    - Icon: ChevronLeft or X
    - Color: white
    - Background: transparent
    - Hover: rgba(255, 255, 255, 0.1)
  
  Title:
    - Font: 16px, weight 500
    - Color: white
    - Overflow: text-overflow: ellipsis
    - Max-width: calc(100% - 200px)
  
  Action Buttons (Share, Download, More):
    - Size: 40×40px each
    - Gap: 8px between buttons
    - Same styling as Back button
```

**Landscape Mode:**
```
Height: 44px (reduced for more media space)
All other specs same as portrait
```

### Media Container Component

**Portrait Mode:**
```
Width: 100vw
Max-height: 60vh
Background: #000000
Display: flex
Align-items: center
Justify-content: center
Position: relative

Image/Video:
  - Max-width: 100vw
  - Max-height: 60vh
  - Object-fit: contain
  - Transform-origin: center
```

**Landscape Mode:**
```
Width: 100vw
Height: calc(100vh - 44px) /* Account for header */
Background: #000000
```

**Fullscreen Mode:**
```
Width: 100vw
Height: 100vh
Position: fixed
Top: 0, Left: 0
Z-index: 9999
Background: #000000
```

### Zoom Controls Component

```
Position: absolute
Bottom: 16px, Left: 16px
Display: flex-column
Gap: 8px
Z-index: 20

Container:
  - Background: rgba(0, 0, 0, 0.6)
  - Border-radius: 24px
  - Padding: 8px
  - Backdrop-filter: blur(10px)

Each Button:
  - Size: 44×44px (touch target compliant)
  - Icon size: 20×20px
  - Border-radius: 50%
  - Background: transparent
  - Hover: rgba(255, 255, 255, 0.1)
  - Active: rgba(255, 255, 255, 0.2)
  - Color: white

Buttons (top to bottom):
  1. Zoom In [+]
  2. Zoom Out [-]
  3. Reset [⟲]
  4. Fit Mode [⛶]

Animation:
  - Fade in: 200ms ease-in
  - Fade out: 300ms ease-out, delay 2s after inactivity
  - Transform: translateY(0) → translateY(10px) when hiding
```

### Fullscreen Toggle Button

```
Position: absolute
Bottom: 16px, Right: 16px
Size: 48×48px (slightly larger for prominence)
Background: rgba(0, 0, 0, 0.6)
Border-radius: 50%
Z-index: 20

Icon: Maximize/Minimize
Icon size: 24×24px
Color: white

States:
  - Normal: opacity 0.9
  - Hover: opacity 1, scale(1.05)
  - Active: scale(0.95)
```

### Navigation Arrows (Gallery Context)

```
Position: absolute
Top: 50%
Transform: translateY(-50%)
Left: 16px (prev) / Right: 16px (next)
Z-index: 10

Button:
  - Size: 48×48px
  - Background: rgba(0, 0, 0, 0.6)
  - Border-radius: 50%
  - Backdrop-filter: blur(10px)
  
Icon: ChevronLeft / ChevronRight
Icon size: 28×28px
Color: white

States:
  - Disabled: opacity 0.3, cursor: not-allowed
  - Enabled: opacity 0.9
  - Hover: opacity 1, scale(1.1)
  - Active: scale(0.95)

Visibility:
  - Hidden when zoomed
  - Hidden in fullscreen
  - Fade in/out with control visibility
```

### Metadata Panel Component

**Portrait Mode:**
```
Width: 100%
Background: #FFFFFF
Padding: 16px
Border-top: 1px solid #E5E7EB
Position: relative

Header Row:
  - Display: flex
  - Align-items: center
  - Gap: 12px
  - Margin-bottom: 12px
  
  Avatar:
    - Size: 40×40px
    - Border-radius: 50%
    - Object-fit: cover
  
  User Info:
    - Username: 14px, weight 600, color #111827
    - Timestamp: 12px, weight 400, color #6B7280
    - Display: flex-column, gap 2px

Action Row:
  - Display: flex
  - Gap: 16px
  - Margin-bottom: 12px
  
  Like Button:
    - Display: flex, align-items: center
    - Gap: 6px
    - Icon: Heart, 20×20px
    - Text: 14px
    - Color: #6B7280 (inactive), #EF4444 (active)
    - Touch target: 44×44px
  
  Comment Count:
    - Same styling as Like
    - Icon: MessageCircle
  
  Favorite Button:
    - Same styling
    - Icon: Star

Caption:
  - Font: 14px, line-height 1.5
  - Color: #111827
  - Margin-bottom: 12px
  - Max-height: 100px (collapsed)
  - Overflow: hidden
  - Show "Read more" if truncated

Tags Row:
  - Display: flex
  - Gap: 8px
  - Overflow-x: auto
  - Padding-bottom: 4px
  - Hide scrollbar (webkit-scrollbar: none)
  
  Tag:
    - Background: #EFF6FF
    - Color: #2563EB
    - Padding: 4px 12px
    - Border-radius: 12px
    - Font: 12px, weight 500
    - White-space: nowrap

Expand/Collapse Toggle:
  - Position: absolute, top-right
  - Size: 44×44px
  - Icon: ChevronDown/ChevronUp
  - Rotate: 180deg when expanded
  - Transition: transform 300ms ease
```

**Landscape Drawer:**
```
Same content as portrait, but:
  - Width: 100%
  - Height: 60vh
  - Position: fixed, bottom: 0
  - Transform: translateY(60vh) when hidden
  - Transition: transform 300ms ease-out
  - Box-shadow: 0 -4px 20px rgba(0,0,0,0.15)

Drawer Handle:
  - Width: 40px
  - Height: 4px
  - Background: #D1D5DB
  - Border-radius: 2px
  - Margin: 8px auto
  - Cursor: grab
```

### Comments Section Component

**Portrait Mode:**
```
Width: 100%
Background: #FFFFFF
Padding: 0

Header:
  - Padding: 16px
  - Border-bottom: 1px solid #E5E7EB
  - Display: flex
  - Justify-content: space-between
  - Align-items: center
  
  Title: "Comments (N)"
    - Font: 16px, weight 600
    - Color: #111827
  
  Add Button:
    - Size: 32×32px
    - Icon: Plus, 16×16px
    - Border-radius: 50%
    - Background: #EFF6FF
    - Color: #2563EB

Comment Input (Sticky):
  - Position: sticky, top: 0
  - Background: #FFFFFF
  - Padding: 12px 16px
  - Border-bottom: 1px solid #E5E7EB
  - Z-index: 10
  
  Input Field:
    - Width: 100%
    - Padding: 12px 16px
    - Border: 1px solid #E5E7EB
    - Border-radius: 24px
    - Font: 14px
    - Placeholder: "Write a comment..."
    - Focus: border-color #3B82F6, box-shadow

Comment List:
  - Padding: 16px
  - Display: flex-column
  - Gap: 16px

Comment Item:
  - Display: flex
  - Gap: 12px
  
  Avatar:
    - Size: 32×32px
    - Border-radius: 50%
    - Flex-shrink: 0
  
  Content:
    - Flex: 1
    - Display: flex-column
    - Gap: 4px
    
    Username:
      - Font: 14px, weight 600
      - Color: #111827
    
    Text:
      - Font: 14px, line-height 1.5
      - Color: #374151
      - Word-break: break-word
    
    Meta Row:
      - Display: flex
      - Gap: 12px
      - Font: 12px
      - Color: #6B7280
      - Margin-top: 4px
      
      Items: Time, Reply button, Like count
```

### Video Player Controls Component

```
Position: absolute
Bottom: 0, Left: 0, Right: 0
Background: linear-gradient(to top, rgba(0,0,0,0.8), transparent)
Padding: 16px
Z-index: 20

Progress Bar:
  - Width: 100%
  - Height: 8px (12px when touched)
  - Background: rgba(255, 255, 255, 0.3)
  - Border-radius: 4px
  - Margin-bottom: 16px
  
  Progress Fill:
    - Background: #3B82F6
    - Height: 100%
    - Border-radius: 4px
  
  Scrubber:
    - Size: 16×16px
    - Background: #FFFFFF
    - Border-radius: 50%
    - Box-shadow: 0 2px 4px rgba(0,0,0,0.3)
    - Touch area: 44×44px

Control Row:
  - Display: flex
  - Justify-content: space-between
  - Align-items: center

Left Controls:
  - Display: flex
  - Gap: 12px
  
  Play/Pause Button:
    - Size: 44×44px
    - Icon: 24×24px
    - Background: transparent
    - Color: white
  
  Time Display:
    - Font: 14px, monospace
    - Color: white
    - Format: "0:00 / 0:00"

Right Controls:
  - Display: flex
  - Gap: 12px
  
  Volume Button:
    - Size: 44×44px
    - Shows popup slider on tap
  
  Quality Button:
    - Size: 44×44px
    - Shows bottom sheet on tap
  
  Fullscreen Button:
    - Size: 44×44px
    - Icon: Maximize

Volume Popup:
  - Position: absolute, above volume button
  - Width: 48px
  - Height: 160px
  - Background: rgba(0, 0, 0, 0.9)
  - Border-radius: 24px
  - Padding: 12px
  
  Slider:
    - Orientation: vertical
    - Height: 100%
    - Width: 4px

Quality Sheet:
  - Position: fixed, bottom: 0
  - Width: 100%
  - Background: #FFFFFF
  - Border-radius: 16px 16px 0 0
  - Padding: 16px
  - Max-height: 50vh
  
  Options: Auto, 1080p, 720p, 480p, 360p
  Each option: 48px height, full width tap target
```

---

## 3. Icon Set for All Buttons

### Icon Library: Lucide React

All icons sized at 1x (20px), 2x (40px), 3x (60px) for different DPR displays.

| Button | Icon Name | 1x | 2x | 3x | Color | Notes |
|--------|-----------|-----|-----|-----|-------|-------|
| Back/Close | `ChevronLeft` or `X` | 20px | 40px | 60px | #FFFFFF | Semi-bold stroke |
| Share | `Share2` | 20px | 40px | 60px | #FFFFFF | Outline style |
| Download | `Download` | 20px | 40px | 60px | #FFFFFF | Arrow down |
| More Options | `MoreVertical` | 20px | 40px | 60px | #FFFFFF | Three dots |
| Zoom In | `Plus` or `ZoomIn` | 20px | 40px | 60px | #FFFFFF | Bold stroke |
| Zoom Out | `Minus` or `ZoomOut` | 20px | 40px | 60px | #FFFFFF | Bold stroke |
| Reset View | `RotateCcw` | 20px | 40px | 60px | #FFFFFF | Circular arrow |
| Fit Mode | `Maximize2` | 20px | 40px | 60px | #FFFFFF | Corners |
| Fullscreen Enter | `Maximize` | 24px | 48px | 72px | #FFFFFF | Larger |
| Fullscreen Exit | `Minimize` | 24px | 48px | 72px | #FFFFFF | Larger |
| Previous | `ChevronLeft` | 28px | 56px | 84px | #FFFFFF | Navigation |
| Next | `ChevronRight` | 28px | 56px | 84px | #FFFFFF | Navigation |
| Play | `Play` | 24px | 48px | 72px | #FFFFFF | Filled triangle |
| Pause | `Pause` | 24px | 48px | 72px | #FFFFFF | Two bars |
| Volume On | `Volume2` | 20px | 40px | 60px | #FFFFFF | Waves |
| Volume Off | `VolumeX` | 20px | 40px | 60px | #FFFFFF | Crossed |
| Heart (Like) | `Heart` | 20px | 40px | 60px | #6B7280 / #EF4444 | Outline/filled |
| Comment | `MessageCircle` | 20px | 40px | 60px | #6B7280 | Outline |
| Star (Favorite) | `Star` | 20px | 40px | 60px | #6B7280 / #FBBF24 | Outline/filled |
| Panel Toggle | `PanelLeftClose` | 20px | 40px | 60px | #FFFFFF | Hide panel |
| Panel Open | `PanelLeftOpen` | 20px | 40px | 60px | #FFFFFF | Show panel |
| Expand More | `ChevronDown` | 16px | 32px | 48px | #6B7280 | Metadata |
| Collapse | `ChevronUp` | 16px | 32px | 48px | #6B7280 | Metadata |
| Add Comment | `Plus` | 16px | 32px | 48px | #2563EB | Small |
| Reply | `CornerUpLeft` | 14px | 28px | 42px | #6B7280 | Arrow |

### Icon Export Specifications

```
Format: SVG
Stroke width: 2px (standard), 2.5px (bold for primary actions)
Stroke linecap: round
Stroke linejoin: round
Export sizes:
  - 1x: 20×20px @ 72dpi
  - 2x: 40×40px @ 144dpi  
  - 3x: 60×60px @ 216dpi

File naming: {icon-name}-{size}.svg
Example: zoom-in-1x.svg, zoom-in-2x.svg, zoom-in-3x.svg
```

---

## 4. Animation Specifications

### Duration Values

```css
/* Standard Durations */
--duration-instant: 50ms;
--duration-fast: 100ms;
--duration-normal: 200ms;
--duration-slow: 300ms;
--duration-slower: 400ms;
--duration-slowest: 500ms;

/* Context-Specific */
--duration-tap-feedback: 100ms;
--duration-fade: 200ms;
--duration-slide: 300ms;
--duration-zoom: 300ms;
--duration-drawer: 300ms;
```

### Easing Functions

```css
/* Standard Easing */
--ease-standard: cubic-bezier(0.4, 0.0, 0.2, 1);
--ease-decelerate: cubic-bezier(0.0, 0.0, 0.2, 1);
--ease-accelerate: cubic-bezier(0.4, 0.0, 1, 1);
--ease-sharp: cubic-bezier(0.4, 0.0, 0.6, 1);

/* Bounce & Spring */
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
--ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);

/* iOS-like */
--ease-ios: cubic-bezier(0.25, 0.1, 0.25, 1);
```

### Animation Definitions

#### 1. Modal Open/Close
```css
@keyframes modal-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Usage */
.modal-enter {
  animation: modal-fade-in 300ms var(--ease-decelerate);
}
```

#### 2. Controls Fade In/Out
```css
@keyframes controls-fade {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.controls-visible {
  animation: controls-fade 200ms var(--ease-decelerate) forwards;
}

.controls-hidden {
  animation: controls-fade 300ms var(--ease-accelerate) reverse forwards;
  animation-delay: 2000ms; /* 2s delay before hiding */
}
```

#### 3. Image Zoom (Double-tap or Pinch)
```css
.image-zoom {
  transition: transform 300ms var(--ease-standard);
}

/* With momentum */
.image-zoom.momentum {
  transition: transform 400ms var(--ease-spring);
}
```

#### 4. Drawer Slide Up/Down (Landscape)
```css
@keyframes drawer-slide-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes drawer-slide-down {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(100%);
  }
}

.drawer-enter {
  animation: drawer-slide-up 300ms var(--ease-decelerate);
}

.drawer-exit {
  animation: drawer-slide-down 300ms var(--ease-accelerate);
}
```

#### 5. Metadata Expand/Collapse
```css
@keyframes expand {
  from {
    max-height: 100px;
    opacity: 0.5;
  }
  to {
    max-height: 1000px;
    opacity: 1;
  }
}

.metadata-expanded {
  animation: expand 300ms var(--ease-standard) forwards;
}
```

#### 6. Button Tap Feedback
```css
.button-tap {
  transition: transform 100ms var(--ease-sharp);
}

.button-tap:active {
  transform: scale(0.95);
}
```

#### 7. Fullscreen Transition
```css
@keyframes fullscreen-enter {
  from {
    transform: scale(0.95);
    opacity: 0.8;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.fullscreen-mode {
  animation: fullscreen-enter 300ms var(--ease-decelerate);
}
```

#### 8. Gallery Navigation Swipe
```css
@keyframes slide-next {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-100%);
  }
}

@keyframes slide-prev {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(100%);
  }
}

.navigate-next {
  animation: slide-next 300ms var(--ease-standard);
}

.navigate-prev {
  animation: slide-prev 300ms var(--ease-standard);
}
```

#### 9. Loading Spinner
```css
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.loading-spinner {
  animation: spin 1000ms linear infinite;
}
```

#### 10. Progress Bar Fill
```css
.progress-fill {
  transition: width 200ms var(--ease-decelerate);
}
```

### Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  
  /* Maintain zoom functionality but remove spring */
  .image-zoom {
    transition: transform 50ms linear;
  }
}
```

---

## 5. Color Values for All UI Elements

### Light Mode (Default)

```css
:root {
  /* Media Background */
  --media-bg: #000000;
  --media-overlay: rgba(0, 0, 0, 0.7);
  --media-overlay-light: rgba(0, 0, 0, 0.4);
  
  /* Controls */
  --control-bg: rgba(0, 0, 0, 0.6);
  --control-bg-hover: rgba(0, 0, 0, 0.7);
  --control-text: #FFFFFF;
  --control-icon: #FFFFFF;
  
  /* Header */
  --header-bg: rgba(0, 0, 0, 0.7);
  --header-text: #FFFFFF;
  --header-border: rgba(255, 255, 255, 0.1);
  
  /* Metadata & Comments */
  --content-bg: #FFFFFF;
  --content-text: #111827;
  --content-text-secondary: #6B7280;
  --content-border: #E5E7EB;
  
  /* Interactive Elements */
  --link-color: #2563EB;
  --link-hover: #1D4ED8;
  --button-primary-bg: #3B82F6;
  --button-primary-hover: #2563EB;
  --button-primary-active: #1D4ED8;
  --button-primary-text: #FFFFFF;
  
  /* Status Colors */
  --status-like-inactive: #6B7280;
  --status-like-active: #EF4444;
  --status-favorite-inactive: #6B7280;
  --status-favorite-active: #FBBF24;
  --status-success: #10B981;
  --status-error: #EF4444;
  --status-warning: #F59E0B;
  --status-info: #3B82F6;
  
  /* Backgrounds */
  --bg-tag: #EFF6FF;
  --bg-tag-text: #2563EB;
  --bg-input: #F9FAFB;
  --bg-input-focus: #FFFFFF;
  
  /* Borders & Dividers */
  --border-light: #F3F4F6;
  --border-medium: #E5E7EB;
  --border-dark: #D1D5DB;
  --border-focus: #3B82F6;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  
  /* Overlays */
  --overlay-backdrop: rgba(0, 0, 0, 0.4);
  --overlay-drawer: rgba(0, 0, 0, 0.5);
}
```

### Dark Mode

```css
[data-theme="dark"] {
  /* Media Background (same) */
  --media-bg: #000000;
  --media-overlay: rgba(0, 0, 0, 0.8);
  --media-overlay-light: rgba(0, 0, 0, 0.5);
  
  /* Controls */
  --control-bg: rgba(255, 255, 255, 0.15);
  --control-bg-hover: rgba(255, 255, 255, 0.25);
  --control-text: #FFFFFF;
  --control-icon: #FFFFFF;
  
  /* Header */
  --header-bg: rgba(0, 0, 0, 0.9);
  --header-text: #FFFFFF;
  --header-border: rgba(255, 255, 255, 0.1);
  
  /* Metadata & Comments */
  --content-bg: #1F2937;
  --content-text: #F9FAFB;
  --content-text-secondary: #9CA3AF;
  --content-border: #374151;
  
  /* Interactive Elements */
  --link-color: #60A5FA;
  --link-hover: #3B82F6;
  --button-primary-bg: #3B82F6;
  --button-primary-hover: #2563EB;
  --button-primary-active: #1D4ED8;
  --button-primary-text: #FFFFFF;
  
  /* Status Colors (slightly adjusted for dark) */
  --status-like-inactive: #9CA3AF;
  --status-like-active: #F87171;
  --status-favorite-inactive: #9CA3AF;
  --status-favorite-active: #FCD34D;
  --status-success: #34D399;
  --status-error: #F87171;
  --status-warning: #FBBF24;
  --status-info: #60A5FA;
  
  /* Backgrounds */
  --bg-tag: #1E3A8A;
  --bg-tag-text: #93C5FD;
  --bg-input: #374151;
  --bg-input-focus: #4B5563;
  
  /* Borders & Dividers */
  --border-light: #374151;
  --border-medium: #4B5563;
  --border-dark: #6B7280;
  --border-focus: #3B82F6;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.5);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.5);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
  
  /* Overlays */
  --overlay-backdrop: rgba(0, 0, 0, 0.7);
  --overlay-drawer: rgba(0, 0, 0, 0.8);
}
```

### Semantic Color Usage

```css
/* Apply colors contextually */
.media-container { background: var(--media-bg); }
.control-button { 
  background: var(--control-bg); 
  color: var(--control-text);
}
.control-button:hover { background: var(--control-bg-hover); }

.header { 
  background: var(--header-bg); 
  color: var(--header-text); 
}

.metadata-panel { 
  background: var(--content-bg); 
  color: var(--content-text); 
}

.like-button.active { color: var(--status-like-active); }
.favorite-button.active { color: var(--status-favorite-active); }

.tag { 
  background: var(--bg-tag); 
  color: var(--bg-tag-text); 
}

.input-field { 
  background: var(--bg-input);
  border: 1px solid var(--border-medium);
}
.input-field:focus {
  background: var(--bg-input-focus);
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
```

---

## 6. Typography Specifications

### Font Stack

```css
:root {
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, 
               "Helvetica Neue", Arial, sans-serif;
  --font-mono: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", 
               Consolas, monospace;
}
```

### Type Scale

```css
/* Font Sizes */
--text-xs: 12px;      /* line-height: 16px */
--text-sm: 14px;      /* line-height: 20px */
--text-base: 16px;    /* line-height: 24px */
--text-lg: 18px;      /* line-height: 28px */
--text-xl: 20px;      /* line-height: 28px */
--text-2xl: 24px;     /* line-height: 32px */

/* Font Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;

/* Letter Spacing */
--tracking-tight: -0.01em;
--tracking-normal: 0;
--tracking-wide: 0.01em;
```

### Component Typography

```css
/* Header */
.header-title {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  line-height: 24px;
  letter-spacing: var(--tracking-normal);
}

/* Metadata */
.username {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  line-height: 20px;
}

.timestamp {
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: var(--font-normal);
  line-height: 16px;
  color: var(--content-text-secondary);
}

.caption {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--font-normal);
  line-height: 21px; /* 1.5 line height */
  letter-spacing: var(--tracking-normal);
}

/* Tags */
.tag {
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  line-height: 16px;
  letter-spacing: var(--tracking-wide);
}

/* Comments */
.comment-username {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  line-height: 20px;
}

.comment-text {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--font-normal);
  line-height: 21px;
}

.comment-meta {
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: var(--font-normal);
  line-height: 16px;
  color: var(--content-text-secondary);
}

/* Video Time Display */
.video-time {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  line-height: 20px;
  letter-spacing: var(--tracking-wide);
  font-variant-numeric: tabular-nums;
}

/* Button Labels */
.button-label {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  line-height: 20px;
  letter-spacing: var(--tracking-wide);
}

/* Section Headers */
.section-header {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  line-height: 24px;
  letter-spacing: var(--tracking-tight);
}
```

### Responsive Typography Adjustments

```css
/* Smaller screens - slightly reduce sizes */
@media (max-width: 360px) {
  :root {
    --text-xs: 11px;
    --text-sm: 13px;
    --text-base: 15px;
    --text-lg: 17px;
  }
}

/* Larger screens - slightly increase sizes */
@media (min-width: 768px) and (orientation: landscape) {
  :root {
    --text-base: 16px;
    --text-lg: 19px;
  }
}
```

---

## 7. Touch Target Sizing and Spacing Grid

### Touch Target Standards (Based on Apple & Google Guidelines)

```css
/* Minimum Touch Targets */
--touch-min: 44px;        /* iOS minimum (Apple HIG) */
--touch-recommended: 48px; /* Material Design recommended */
--touch-comfortable: 56px; /* Comfortable for thumbs */

/* Spacing Between Targets */
--touch-spacing-min: 8px;
--touch-spacing-recommended: 12px;
--touch-spacing-comfortable: 16px;
```

### Grid System

```css
/* 8-point Grid System */
--grid-unit: 8px;

/* Common Multiples */
--space-1: 8px;   /* 1 unit */
--space-2: 16px;  /* 2 units */
--space-3: 24px;  /* 3 units */
--space-4: 32px;  /* 4 units */
--space-5: 40px;  /* 5 units */
--space-6: 48px;  /* 6 units */
--space-7: 56px;  /* 7 units */
--space-8: 64px;  /* 8 units */

/* Half Units (for fine-tuning) */
--space-0.5: 4px;
--space-1.5: 12px;
--space-2.5: 20px;
```

### Component Touch Target Specifications

```css
/* Primary Action Buttons */
.button-primary {
  min-width: 48px;
  min-height: 48px;
  padding: 12px 24px; /* 1.5 × 3 units */
}

/* Icon Buttons */
.icon-button {
  width: 44px;
  height: 44px;
  padding: 10px; /* Centers 24px icon */
}

/* Icon Buttons Small (secondary actions) */
.icon-button-sm {
  width: 40px;
  height: 40px;
  padding: 10px; /* Centers 20px icon */
}

/* List Items (Comments, Options) */
.list-item {
  min-height: 48px;
  padding: 12px 16px;
}

/* Input Fields */
.input-field {
  min-height: 48px;
  padding: 12px 16px;
}

/* Slider Thumbs */
.slider-thumb {
  width: 24px;
  height: 24px;
  /* Touch area expanded with pseudo-element */
}
.slider-thumb::before {
  content: '';
  position: absolute;
  width: 44px;
  height: 44px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
```

### Layout Examples with Grid

#### Header Layout
```
Vertical: [8px padding] + [40px button] + [8px padding] = 56px total
Horizontal: [16px] [40px button] [auto space] [text] [auto space] [40px] [8px] [40px] [8px] [40px] [16px]
```

#### Metadata Panel
```
Padding: 16px (2 units) all sides
Avatar: 40px (5 units)
Gap between avatar and text: 12px (1.5 units)
Vertical spacing between sections: 12px (1.5 units)
Action buttons: 44px touch target with 16px gap (2 units)
```

#### Comments List
```
Comment item:
  Padding: 16px horizontal, 12px vertical
  Avatar: 32px (4 units)
  Gap: 12px (1.5 units)
  Reply button: 44×44px target (positioned with 8px spacing)
```

### Spacing Decision Tree

```
Choose spacing based on relationship:
- 4px: Tightly related (icon + label)
- 8px: Related items in group (buttons in toolbar)
- 12px: Separated items within section
- 16px: Section padding, card padding
- 24px: Space between major sections
- 32px+: Large visual separation
```

---

## 8. Gesture Interaction Flows

### Gesture Map

| Gesture | Context | Action | Visual Feedback |
|---------|---------|--------|-----------------|
| **Single Tap** | Media (not zoomed) | Show/hide controls | Controls fade in/out |
| **Single Tap** | Media (zoomed) | Pan image (drag) | Image follows finger |
| **Double Tap** | Image | Zoom 2x at point | Smooth zoom animation |
| **Double Tap** | Image (zoomed) | Reset to fit | Smooth zoom out |
| **Pinch Open** | Image | Zoom in (1x-5x) | Live scaling as fingers move |
| **Pinch Close** | Image | Zoom out (min 1x) | Live scaling as fingers move |
| **Swipe Left** | Media (not zoomed) | Next item in gallery | Slide animation left |
| **Swipe Right** | Media (not zoomed) | Previous item in gallery | Slide animation right |
| **Swipe Down** | Media (from top) | Close viewer | Slide down and fade out |
| **Swipe Down** | Fullscreen | Exit fullscreen | Return to normal view |
| **Swipe Up** | Landscape drawer | Open metadata/comments | Drawer slides up |
| **Swipe Down** | Landscape drawer | Close drawer | Drawer slides down |
| **Long Press** | Media | Show context menu | Menu appears with haptic |
| **Pan** | Media (zoomed) | Move around image | Image follows with momentum |
| **Swipe Up** | Video (playing) | Enter fullscreen | Video expands with animation |
| **Two-Finger Tap** | Image | Toggle fit modes | Mode indicator briefly shown |

### Detailed Gesture Behaviors

#### 1. Single Tap - Show/Hide Controls

```
State: Controls hidden
↓
User taps anywhere on media
↓
Controls fade in with slide-up (200ms)
↓
Timer starts (3 seconds)
↓
If no interaction: Controls fade out (300ms)
```

```javascript
// Pseudo-code
onTap(event) {
  if (isZoomed) return; // Don't toggle controls when zoomed
  
  if (controlsVisible) {
    hideControls(300); // Fade out
  } else {
    showControls(200); // Fade in
    startHideTimer(3000); // Auto-hide after 3s
  }
}
```

#### 2. Double Tap - Zoom In/Out

```
State: Image at 1x zoom
↓
User double-taps at point (x, y)
↓
Calculate zoom point relative to image
↓
Animate zoom from 1x to 2x (300ms, ease-standard)
Center animation on tap point
↓
State: Image at 2x zoom

If already zoomed:
↓
Animate zoom from current to 1x (300ms)
Reset pan position to (0, 0)
```

```javascript
// Pseudo-code
onDoubleTap(event) {
  const tapPoint = { x: event.clientX, y: event.clientY };
  
  if (zoom === 1) {
    // Zoom in to 2x at tap point
    animateZoom({
      from: 1,
      to: 2,
      duration: 300,
      center: tapPoint,
      easing: 'ease-standard'
    });
  } else {
    // Zoom out to 1x and reset pan
    animateZoom({
      from: zoom,
      to: 1,
      duration: 300,
      easing: 'ease-standard'
    });
    animatePan({
      from: pan,
      to: { x: 0, y: 0 },
      duration: 300
    });
  }
}
```

#### 3. Pinch Zoom

```
State: Two fingers touch screen
↓
Calculate initial distance between fingers (d1)
Calculate midpoint between fingers (center)
↓
User moves fingers
↓
Calculate new distance (d2)
Calculate scale factor: newZoom = currentZoom × (d2 / d1)
Clamp: newZoom = Math.max(1, Math.min(5, newZoom))
↓
Apply zoom transform centered on midpoint
Update in real-time (60fps)
↓
Fingers lift
↓
If zoom < 1.1: Animate back to 1x (spring animation)
If zoom > 5: Animate down to 5x (spring animation)
```

```javascript
// Pseudo-code
onPinchStart(event) {
  const touches = event.touches;
  initialDistance = getDistance(touches[0], touches[1]);
  initialZoom = currentZoom;
  pinchCenter = getMidpoint(touches[0], touches[1]);
}

onPinchMove(event) {
  const touches = event.touches;
  const newDistance = getDistance(touches[0], touches[1]);
  const scale = newDistance / initialDistance;
  const newZoom = Math.max(1, Math.min(5, initialZoom * scale));
  
  applyZoom(newZoom, pinchCenter);
  requestAnimationFrame(updateTransform);
}

onPinchEnd() {
  if (currentZoom < 1.1) {
    animateZoom(currentZoom, 1, { duration: 300, easing: 'spring' });
  } else if (currentZoom > 5) {
    animateZoom(currentZoom, 5, { duration: 300, easing: 'spring' });
  }
}
```

#### 4. Horizontal Swipe - Gallery Navigation

```
State: User finger touches media (not zoomed)
↓
Track initial touch position (x0, y0)
↓
User drags finger
↓
Calculate delta: dx = currentX - x0, dy = currentY - y0
↓
If |dx| > |dy| (horizontal movement dominant):
  Visual: Media follows finger with drag offset
  Apply: transform: translateX(dx)
↓
User lifts finger
↓
Calculate velocity: v = dx / dt
↓
Threshold check:
  If dx > 30% screen width OR v > 0.5px/ms:
    Direction: dx > 0 ? Previous : Next
    Animate to previous/next media (300ms)
  Else:
    Snap back to center (200ms, spring)
```

```javascript
// Pseudo-code
onSwipeStart(event) {
  if (isZoomed) return; // Don't navigate when zoomed
  
  startX = event.touches[0].clientX;
  startY = event.touches[0].clientY;
  startTime = Date.now();
}

onSwipeMove(event) {
  if (isZoomed) return;
  
  const dx = event.touches[0].clientX - startX;
  const dy = event.touches[0].clientY - startY;
  
  if (Math.abs(dx) > Math.abs(dy)) {
    event.preventDefault(); // Prevent scroll
    applyTransform(`translateX(${dx}px)`);
    showRubberBand(dx); // Visual feedback at edges
  }
}

onSwipeEnd(event) {
  const dx = endX - startX;
  const dt = Date.now() - startTime;
  const velocity = dx / dt;
  const threshold = window.innerWidth * 0.3;
  
  if (dx > threshold || velocity > 0.5) {
    navigateToPrevious();
  } else if (dx < -threshold || velocity < -0.5) {
    navigateToNext();
  } else {
    snapBack();
  }
}
```

#### 5. Vertical Swipe Down - Close Viewer

```
State: User swipes down from top of media
↓
Track vertical movement
↓
If dy > 100px and moving downward:
  Visual: Media slides down with finger
  Background opacity: 1 - (dy / screenHeight)
↓
User lifts finger
↓
If dy > 150px:
  Complete close: Animate out (300ms)
  Call onClose()
Else:
  Snap back to position (200ms)
```

#### 6. Drawer Swipe (Landscape)

```
State: Drawer closed
↓
User swipes up from bottom edge
↓
If swipe starts within 50px of bottom:
  Drawer follows finger upward
  Visual: Drawer slides up, backdrop fades in
↓
Release threshold check:
  If dragged > 40% of drawer height:
    Animate to fully open (300ms)
  Else:
    Snap back to closed (200ms)

When drawer open:
↓
User swipes down on drawer
↓
Drawer follows finger downward
↓
Release:
  If dragged down > 30%:
    Close drawer (300ms)
  Else:
    Snap back open (200ms)
```

### Gesture Conflict Resolution

```
Priority Order (highest to lowest):
1. Pinch zoom (two fingers)
2. Pan image (when zoomed)
3. Horizontal swipe navigation (not zoomed)
4. Vertical swipe close (from top)
5. Single tap (controls)
6. Scroll content (metadata/comments)
```

```javascript
// Decision tree
onTouchStart(event) {
  if (event.touches.length === 2) {
    mode = 'PINCH_ZOOM';
  } else if (isZoomed && isOnMedia) {
    mode = 'PAN';
  } else if (isOnMedia && !isZoomed) {
    mode = 'SWIPE_NAV';
  } else {
    mode = 'DEFAULT';
  }
}

onTouchMove(event) {
  switch (mode) {
    case 'PINCH_ZOOM':
      handlePinch(event);
      break;
    case 'PAN':
      handlePan(event);
      break;
    case 'SWIPE_NAV':
      const dx = currentX - startX;
      const dy = currentY - startY;
      
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        handleHorizontalSwipe(event);
      } else if (dy > 50 && startY < 100) {
        handleVerticalSwipe(event);
      }
      break;
  }
}
```

---

## 9. Error State Visuals

### Error Types and Designs

#### 1. Network Error - Failed to Load Media

**Portrait Mode:**
```
┌─────────────────────────────────┐
│  [<]  Media Title...      [⋮][↓] │
├─────────────────────────────────┤
│                                 │
│         ┌─────────┐             │
│         │  /!\\    │             │
│         │         │             │
│         │ Failed  │             │
│         │to Load  │             │
│         └─────────┘             │
│                                 │
│    Unable to load image         │
│    Check your connection        │
│                                 │
│    [↻ Retry]  [⬇ Download]     │
│                                 │
├─────────────────────────────────┤
│ Metadata still accessible...    │
└─────────────────────────────────┘
```

**Styling:**
```css
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  background: var(--media-bg);
  padding: 32px;
}

.error-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.error-icon svg {
  width: 40px;
  height: 40px;
  color: #EF4444;
}

.error-title {
  font-size: 18px;
  font-weight: 600;
  color: #F9FAFB;
  margin-bottom: 8px;
  text-align: center;
}

.error-message {
  font-size: 14px;
  color: #9CA3AF;
  text-align: center;
  margin-bottom: 24px;
  max-width: 280px;
}

.error-actions {
  display: flex;
  gap: 12px;
}

.error-button {
  min-width: 120px;
  height: 48px;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.error-button-primary {
  background: #3B82F6;
  color: white;
}

.error-button-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
}
```

#### 2. Slow Loading - Progress Indicator

```
┌─────────────────────────────────┐
│  [<]  Media Title...      [⋮][↓] │
├─────────────────────────────────┤
│                                 │
│           ⟳                     │
│                                 │
│       Loading image...          │
│       ▓▓▓▓▓░░░░░░░░░ 42%       │
│                                 │
│       Slow connection           │
│       This may take a moment    │
│                                 │
│       [× Cancel]                │
│                                 │
└─────────────────────────────────┘
```

**Styling:**
```css
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  background: var(--media-bg);
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(59, 130, 246, 0.2);
  border-top-color: #3B82F6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 24px;
}

.loading-text {
  font-size: 16px;
  color: #F9FAFB;
  margin-bottom: 16px;
}

.loading-progress {
  width: 240px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 8px;
}

.loading-progress-bar {
  height: 100%;
  background: #3B82F6;
  transition: width 300ms ease-out;
}

.loading-percentage {
  font-size: 12px;
  color: #9CA3AF;
  margin-bottom: 16px;
}

.loading-subtext {
  font-size: 13px;
  color: #9CA3AF;
  margin-bottom: 24px;
  text-align: center;
}
```

#### 3. Format Not Supported

```
┌─────────────────────────────────┐
│  [<]  Media Title...      [⋮][↓] │
├─────────────────────────────────┤
│                                 │
│         ┌─────────┐             │
│         │  [?]    │             │
│         │  .HEIC  │             │
│         └─────────┘             │
│                                 │
│    Format Not Supported         │
│    This device cannot display   │
│    HEIC format images          │
│                                 │
│    [↓ Download]  [? Help]      │
│                                 │
└─────────────────────────────────┘
```

#### 4. Processing - Video Not Ready

```
┌─────────────────────────────────┐
│  [<]  Video Title...      [⋮][↓] │
├─────────────────────────────────┤
│                                 │
│         ⚙️ ⟳                    │
│                                 │
│    Video Processing...          │
│    This video is being prepared │
│    for playback                 │
│                                 │
│    Status: Transcoding          │
│    Estimated: 2-3 minutes       │
│                                 │
│    [🔄 Check Status]            │
│    [✕ Close]                    │
│                                 │
├─────────────────────────────────┤
│ Metadata available...           │
└─────────────────────────────────┘
```

#### 5. Permission Denied

```
┌─────────────────────────────────┐
│  [<]  Media Title...      [⋮][↓] │
├─────────────────────────────────┤
│                                 │
│         🔒                      │
│                                 │
│    Private Content              │
│    You don't have permission    │
│    to view this media           │
│                                 │
│    [← Go Back]                  │
│                                 │
└─────────────────────────────────┘
```

#### 6. Media Deleted

```
┌─────────────────────────────────┐
│  [<]  [Back]                     │
├─────────────────────────────────┤
│                                 │
│         🗑️                      │
│                                 │
│    Media Not Found              │
│    This content has been        │
│    deleted or moved             │
│                                 │
│    [← Return to Gallery]        │
│                                 │
└─────────────────────────────────┘
```

### Toast Notifications (Transient Errors)

```
Position: Bottom center, above comments
Size: Max-width 320px, auto height
Padding: 12px 16px
Background: rgba(0, 0, 0, 0.9)
Border-radius: 8px
Animation: Slide up + fade in (300ms), auto-dismiss after 3s

Examples:
┌──────────────────────────┐
│ ⚠️ Poor network connection │
│   Quality reduced to 480p  │
└──────────────────────────┘

┌──────────────────────────┐
│ ✓ Image downloaded        │
└──────────────────────────┘

┌──────────────────────────┐
│ ℹ️ Zoom limit reached     │
└──────────────────────────┘
```

**Toast Styling:**
```css
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 320px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.95);
  border-radius: 8px;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 100;
}

.toast-enter {
  animation: toast-slide-up 300ms ease-out;
}

.toast-exit {
  animation: toast-fade-out 200ms ease-in;
}

@keyframes toast-slide-up {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.toast-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.toast-message {
  font-size: 14px;
  color: white;
  line-height: 1.4;
}
```

---

## 10. Loading State Animations

### 1. Initial Image Load - Blur Placeholder

```
Sequence:
1. Thumbnail (blur: 20px) → Instant
2. Fade to medium quality (blur: 0) → 200ms
3. Swap to full quality → 200ms fade
```

**Implementation:**
```css
.image-loading {
  position: relative;
}

.image-thumbnail {
  filter: blur(20px);
  transform: scale(1.1); /* Compensate for blur edges */
  transition: opacity 200ms ease-out;
}

.image-medium {
  position: absolute;
  top: 0;
  left: 0;
  opacity: 0;
  transition: opacity 200ms ease-in;
}

.image-medium.loaded {
  opacity: 1;
}

.image-full {
  position: absolute;
  top: 0;
  left: 0;
  opacity: 0;
  transition: opacity 200ms 200ms ease-in; /* Delayed */
}

.image-full.loaded {
  opacity: 1;
}
```

### 2. Spinner - Media Loading

**Three variations:**

#### A. Circular Spinner (default)
```
┌─────┐
│  ⟳  │  → Rotates continuously
└─────┘
```

```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(59, 130, 246, 0.2);
  border-top-color: #3B82F6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
```

#### B. Pulsing Dots (alternate)
```
● ● ●  → Pulses left to right
```

```css
@keyframes dot-pulse {
  0%, 80%, 100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}

.dot-loader {
  display: flex;
  gap: 8px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #3B82F6;
  animation: dot-pulse 1.4s ease-in-out infinite;
}

.dot:nth-child(1) { animation-delay: 0s; }
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }
```

#### C. Progress Ring (for determinateloading)
```
    ○ 73%  → Ring fills clockwise
```

```css
.progress-ring {
  width: 64px;
  height: 64px;
  transform: rotate(-90deg);
}

.progress-ring-circle {
  stroke: rgba(59, 130, 246, 0.2);
  fill: none;
  stroke-width: 4;
}

.progress-ring-progress {
  stroke: #3B82F6;
  fill: none;
  stroke-width: 4;
  stroke-dasharray: 200;
  stroke-dashoffset: 200;
  transition: stroke-dashoffset 0.3s ease;
  stroke-linecap: round;
}

/* JavaScript: Set dashoffset based on percentage */
/* dashoffset = circumference - (circumference * percentage / 100) */
```

### 3. Skeleton Loading - Metadata Panel

```
Before data loads:
┌─────────────────────────────────┐
│ ▓▓▓ ▒▒▒▒▒▒▒▒▒▒▒▒                │ ← Shimmer effect
│     ▒▒▒▒▒▒ ▒▒▒▒                  │
│                                 │
│ ▓▓ ▒▒  ▓▓ ▒▒  ▓▓ ▒▒▒▒          │
│                                 │
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒              │
│ ▒▒▒▒▒▒▒▒▒▒                      │
└─────────────────────────────────┘
```

**Implementation:**
```css
.skeleton {
  background: linear-gradient(
    90deg,
    #E5E7EB 0%,
    #F3F4F6 50%,
    #E5E7EB 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.skeleton-text {
  height: 16px;
  margin-bottom: 8px;
}

.skeleton-text-short {
  width: 60%;
}

.skeleton-text-long {
  width: 100%;
}
```

### 4. Video Buffering Indicator

```
Overlay on video when buffering:
       ⟳
   Buffering...
   
Appears after 500ms delay
Fades out when ready
```

```css
.video-buffering {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 12px;
  backdrop-filter: blur(10px);
  animation: fade-in 200ms ease-out 500ms both;
}

.buffering-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.buffering-text {
  font-size: 14px;
  color: white;
}
```

### 5. Progressive Image Quality Upgrade

```
Visual feedback when upgrading quality:
1. Show "Upgrading to HD..." toast (1s)
2. Fade transition to higher quality (200ms)
3. Show "HD" badge briefly (2s) then fade
```

```css
.quality-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 4px 12px;
  background: rgba(16, 185, 129, 0.9);
  color: white;
  font-size: 12px;
  font-weight: 600;
  border-radius: 4px;
  animation: badge-appear 300ms ease-out, 
             badge-disappear 300ms ease-in 1.7s both;
}

@keyframes badge-appear {
  from {
    opacity: 0;
    transform: scale(0.8) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes badge-disappear {
  to {
    opacity: 0;
    transform: scale(0.9) translateY(-5px);
  }
}
```

### 6. Gallery Navigation Loading

```
When navigating to next/prev media:

Option A: Crossfade
  Current fades out while next fades in (300ms)

Option B: Slide with loading
  Current slides out, spinner appears, new slides in

Option C: Instant with placeholder
  Immediate thumbnail, upgrade to full quality
```

**Implementation (Crossfade):**
```css
.media-exit {
  animation: fade-out 300ms ease-out both;
}

.media-enter {
  animation: fade-in 300ms ease-in 150ms both;
}

@keyframes fade-out {
  to {
    opacity: 0;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

### 7. Pull-to-Refresh Indicator (Optional Enhancement)

```
User pulls down from top:
  Threshold 0-60px: Arrow pointing down grows
  Threshold 60+px: Arrow rotates 180° (points up)
  Release: Spinner replaces arrow, refresh action

Visual:
    ↓  →  ⇩  →  ⟳
```

```css
.pull-refresh {
  position: absolute;
  top: -80px;
  left: 50%;
  transform: translateX(-50%);
  width: 48px;
  height: 48px;
  transition: transform 200ms ease-out;
}

.pull-refresh.pulling {
  transform: translateX(-50%) translateY(var(--pull-distance));
}

.pull-refresh-arrow {
  transition: transform 200ms ease-out;
}

.pull-refresh.ready .pull-refresh-arrow {
  transform: rotate(180deg);
}

.pull-refresh.refreshing .pull-refresh-arrow {
  display: none;
}

.pull-refresh-spinner {
  display: none;
}

.pull-refresh.refreshing .pull-refresh-spinner {
  display: block;
  animation: spin 1s linear infinite;
}
```

---

## Summary

These design deliverables provide a complete visual and interaction design system for the mobile media viewer. All components are:

- ✅ Touch-optimized with 44×44px minimum targets
- ✅ Consistent with desktop viewer (450px sidebar, 16px padding)
- ✅ Accessible with proper contrast and screen reader support
- ✅ Animated smoothly with specified durations and easing
- ✅ Responsive to portrait and landscape orientations
- ✅ Ready for both light and dark modes

Next steps:
1. Review mockups with team
2. Create interactive HTML prototypes (see separate files)
3. User testing on real devices
4. Iterate based on feedback
5. Implementation in React/Next.js




