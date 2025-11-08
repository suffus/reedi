# Mobile Media Viewer - Interactive Mockups

This directory contains interactive HTML mockups demonstrating the mobile media viewer designs specified in `../mobile-media-viewer-design-spec.md`.

## Mockup Files

### 1. `portrait-viewer.html`
**Portrait Mode Viewer**

Demonstrates the vertical scrolling layout optimized for phone portrait orientation.

**Features:**
- Fixed header with title and action buttons
- Full-width media display (max 60vh)
- Zoom controls with pinch-to-zoom simulation
- Metadata panel below media (expandable)
- Comments section with scrolling
- Double-tap to zoom 2×
- Drag to pan when zoomed

**Best viewed on:**
- Mobile phone in portrait mode
- Desktop browser with width < 768px
- Responsive mode in DevTools (375×667 or 414×896)

**Key Interactions:**
- Tap anywhere to show/hide controls
- Double-tap image to zoom
- Click zoom buttons to zoom in/out
- Drag image when zoomed to pan
- Scroll down to see metadata and comments

---

### 2. `landscape-viewer.html`
**Landscape Mode Viewer with Drawer**

Demonstrates the landscape layout where metadata and comments appear in a slide-up drawer.

**Features:**
- Reduced header height (44px for more screen space)
- Media fills available viewport
- "Show Info" button to open drawer
- Drawer slides up from bottom covering 60% of screen
- Draggable drawer handle to close
- Click backdrop to dismiss drawer

**Best viewed on:**
- Mobile phone in landscape mode
- Tablet in landscape
- Desktop browser in landscape aspect ratio
- Responsive mode rotated to landscape

**Key Interactions:**
- Click "Show Info" to open metadata/comments drawer
- Drag the handle down to close drawer
- Click outside drawer to dismiss
- Controls auto-hide after 3 seconds

---

### 3. `fullscreen-viewer.html`
**Fullscreen/Immersive Mode**

Demonstrates the distraction-free fullscreen viewing experience.

**Features:**
- Pure black background
- Media fills entire viewport (100vh × 100vw)
- Minimal controls that auto-hide
- Pinch-to-zoom support (1× to 5×)
- Zoom level indicator
- Swipe down to exit hint
- First-time instructions overlay

**Best viewed on:**
- Any device in full-screen mode (F11 or browser fullscreen)
- Mobile devices (best experience)

**Key Interactions:**
- Tap anywhere to show/hide controls
- Double-tap to zoom 2×
- Pinch to zoom (on touch devices)
- Drag to pan when zoomed
- Swipe down from top to exit
- Press Escape to exit (keyboard)
- Click X button to exit

---

## How to View

### Option 1: Local File
1. Open any HTML file directly in your browser
2. Right-click file → "Open with" → Choose your browser

### Option 2: Live Server (Recommended)
```bash
# If you have Python installed:
cd mockups
python3 -m http.server 8000

# Then open: http://localhost:8000/portrait-viewer.html
```

### Option 3: VS Code Live Server
1. Install "Live Server" extension
2. Right-click HTML file → "Open with Live Server"

---

## Testing Scenarios

### Portrait Mode Testing
1. **Resize browser** to phone width (375px - 414px)
2. **Test zoom:**
   - Double-click image to zoom 2×
   - Click zoom buttons
   - Drag image when zoomed
3. **Test controls:**
   - Click image to hide/show controls
   - Wait 3s for auto-hide
4. **Test interactions:**
   - Like button
   - Expand metadata
   - Comment input focus

### Landscape Mode Testing
1. **Rotate device** or resize browser to landscape
2. **Test drawer:**
   - Click "Show Info" button
   - Drag handle down to close
   - Click backdrop to dismiss
3. **Verify:** Media uses full available height

### Fullscreen Testing
1. **Enter fullscreen:**
   - Browser: Press F11
   - Mobile: Use browser fullscreen feature
2. **Test all zoom methods:**
   - Double-tap
   - Pinch (touch device)
   - Buttons
3. **Test exit methods:**
   - Swipe down
   - X button
   - Escape key

---

## Design Specifications

All mockups follow the specifications detailed in:
**`../mobile-media-viewer-design-spec.md`**

### Key Specifications Applied:

**Layout Variables:**
- Header height: 56px (portrait), 44px (landscape)
- Touch targets: 44×44px minimum
- Spacing: 8px grid system
- Padding: 16px standard
- Media max-height: 60vh (portrait)

**Colors:**
- Media background: `#000000`
- Control overlay: `rgba(0, 0, 0, 0.6)`
- Content background: `#FFFFFF`
- Primary action: `#3B82F6`

**Typography:**
- Font family: System fonts (-apple-system, etc.)
- Title: 16px (portrait), 15px (landscape)
- Body text: 14px
- Small text: 12px

**Animations:**
- Controls fade: 200ms-300ms
- Zoom transition: 300ms cubic-bezier(0.4, 0, 0.2, 1)
- Drawer slide: 300ms cubic-bezier(0, 0, 0.2, 1)
- Auto-hide delay: 2-3 seconds

**Icons:**
- Using inline SVG (20×20px standard, 24×24px large)
- Stroke width: 2px
- Rounded linecaps and joins

---

## Browser Compatibility

**Tested and working in:**
- ✅ Chrome/Edge (desktop & mobile)
- ✅ Safari (desktop & iOS)
- ✅ Firefox (desktop & mobile)

**Features used:**
- CSS Grid & Flexbox
- CSS Transforms
- CSS Transitions
- Touch Events API
- Backdrop Filter (with fallback)
- CSS Custom Properties

**Fallbacks provided for:**
- Backdrop filter (older browsers)
- Touch events (mouse events as fallback)
- CSS Grid (flexbox fallback)

---

## Customization

### Change Images
Replace the Unsplash URLs with your own:
```javascript
src="https://your-image-url.jpg"
```

### Adjust Colors
Modify CSS variables at the top of each file:
```css
--media-bg: #000000;
--control-bg: rgba(0, 0, 0, 0.6);
--primary-color: #3B82F6;
```

### Adjust Timings
Change animation durations:
```css
transition: opacity 300ms ease;
```

Change auto-hide delays:
```javascript
setTimeout(() => { /* hide */ }, 3000); // 3 seconds
```

---

## Known Limitations

1. **Pinch-to-zoom:** Only works on actual touch devices (simulated with buttons on desktop)
2. **Gesture hints:** Visual feedback could be enhanced with actual gesture trails
3. **Video playback:** These mockups show images only; video controls would need additional implementation
4. **Landscape message:** `landscape-viewer.html` shows a message in portrait mode
5. **State persistence:** Zoom level and position reset on page reload

---

## Next Steps

1. ✅ **Review mockups** with design team
2. ✅ **User testing** on real devices
3. **Iterate** based on feedback
4. **Implement** in React/Next.js
5. **Add video** player controls
6. **Add navigation** arrows for gallery context
7. **Add accessibility** features (ARIA labels, focus management)
8. **Performance** optimization for large images

---

## Questions or Feedback?

These mockups are meant to be starting points for discussion and refinement. Try them on different devices and provide feedback on:

- Layout and spacing
- Control placement and sizing
- Interaction patterns
- Animation speeds and easing
- Color and contrast
- Touch target sizes
- Overall user experience

---

## File Structure

```
mockups/
├── README.md                  ← You are here
├── portrait-viewer.html       ← Portrait mode demo
├── landscape-viewer.html      ← Landscape mode demo
└── fullscreen-viewer.html     ← Fullscreen mode demo
```

---

*Last updated: November 1, 2025*

