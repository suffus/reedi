import React from 'react'
import { ModalEventCatcher, withModalEventCatcher } from './modal-event-catcher'

// Example 1: Basic modal wrapper
export function BasicModalExample() {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open Basic Modal</button>
      
      {isOpen && (
        <ModalEventCatcher
          onEscape={() => setIsOpen(false)}
          onBackdropClick={() => setIsOpen(false)}
        >
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md">
            <h2 className="text-xl font-bold mb-4">Basic Modal</h2>
            <p className="mb-4">This modal catches all events and prevents propagation.</p>
            <button 
              onClick={() => setIsOpen(false)}
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Close
            </button>
          </div>
        </ModalEventCatcher>
      )}
    </>
  )
}

// Example 2: Image viewer with zoom (allows wheel events)
export function ImageViewerModalExample() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [zoom, setZoom] = React.useState(1)

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(prev => Math.max(0.1, Math.min(5, prev * delta)))
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open Image Viewer</button>
      
      {isOpen && (
        <ModalEventCatcher
          onEscape={() => setIsOpen(false)}
          onBackdropClick={() => setIsOpen(false)}
          allowScroll={true} // Allow wheel events for zooming
          allowKeys={['Escape', 'r', 'R']} // Allow reset zoom with 'r' key
        >
          <div 
            className="bg-white p-6 rounded-lg shadow-xl max-w-2xl"
            onWheel={handleWheel}
          >
            <h2 className="text-xl font-bold mb-4">Image Viewer (Zoom: {zoom.toFixed(1)}x)</h2>
            <div className="border-2 border-gray-300 p-4 mb-4">
              <div 
                className="bg-gray-200 w-64 h-48 flex items-center justify-center"
                style={{ transform: `scale(${zoom})` }}
              >
                Sample Image
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setZoom(1)}
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                Reset Zoom
              </button>
              <button 
                onClick={() => setIsOpen(false)}
                className="bg-blue-500 text-white px-4 py-2 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </ModalEventCatcher>
      )}
    </>
  )
}

// Example 3: Form modal (allows typing)
export function FormModalExample() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [text, setText] = React.useState('')

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open Form Modal</button>
      
      {isOpen && (
        <ModalEventCatcher
          onEscape={() => setIsOpen(false)}
          onBackdropClick={() => setIsOpen(false)}
          allowKeys={[
            'Escape',
            'Tab', // Allow tab navigation
            'Enter', // Allow form submission
            'Backspace', // Allow text editing
            'Delete', // Allow text editing
            'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', // Allow cursor movement
            'Home', 'End', // Allow cursor movement
            'PageUp', 'PageDown', // Allow scrolling in text areas
            'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
            'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
            'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
            'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
            '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
            ' ', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_',
            '=', '+', '[', ']', '{', '}', '\\', '|', ';', ':', "'", '"', ',',
            '.', '<', '>', '/', '?', '`', '~'
          ]}
        >
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md">
            <h2 className="text-xl font-bold mb-4">Form Modal</h2>
            <form onSubmit={(e) => { e.preventDefault(); setIsOpen(false) }}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type here... (all keys allowed)"
                className="w-full p-2 border rounded mb-4 h-32"
                autoFocus
              />
              <div className="flex gap-2">
                <button 
                  type="submit"
                  className="bg-green-500 text-white px-4 py-2 rounded"
                >
                  Submit
                </button>
                <button 
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </ModalEventCatcher>
      )}
    </>
  )
}

// Example 4: Using the HOC pattern
const SimpleModal = ({ onClose }: { onClose: () => void }) => (
  <div className="bg-white p-6 rounded-lg shadow-xl max-w-md">
    <h2 className="text-xl font-bold mb-4">HOC Wrapped Modal</h2>
    <p className="mb-4">This modal is wrapped using the HOC pattern.</p>
    <button 
      onClick={onClose}
      className="bg-blue-500 text-white px-4 py-2 rounded"
    >
      Close
    </button>
  </div>
)

// Wrap the component with event catcher
const WrappedSimpleModal = withModalEventCatcher(SimpleModal, {
  onEscape: () => console.log('Escape pressed'),
  allowScroll: false
})

export function HOCExample() {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open HOC Modal</button>
      
      {isOpen && (
        <ModalEventCatcher
          onEscape={() => setIsOpen(false)}
          onBackdropClick={() => setIsOpen(false)}
        >
          <WrappedSimpleModal onClose={() => setIsOpen(false)} />
        </ModalEventCatcher>
      )}
    </>
  )
}

// Example 5: Gallery modal with navigation
export function GalleryModalExample() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const images = ['Image 1', 'Image 2', 'Image 3', 'Image 4']

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open Gallery</button>
      
      {isOpen && (
        <ModalEventCatcher
          onEscape={() => setIsOpen(false)}
          onBackdropClick={() => setIsOpen(false)}
          allowKeys={[
            'Escape',
            'ArrowLeft', // Previous image
            'ArrowRight', // Next image
            'Home', // First image
            'End' // Last image
          ]}
        >
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl">
            <h2 className="text-xl font-bold mb-4">
              Gallery ({currentIndex + 1} of {images.length})
            </h2>
            <div className="border-2 border-gray-300 p-8 mb-4 flex items-center justify-center">
              <div className="text-2xl">{images[currentIndex]}</div>
            </div>
            <div className="flex gap-2 justify-between">
              <button 
                onClick={prevImage}
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                Previous
              </button>
              <button 
                onClick={() => setCurrentIndex(0)}
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                First
              </button>
              <button 
                onClick={() => setCurrentIndex(images.length - 1)}
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                Last
              </button>
              <button 
                onClick={nextImage}
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                Next
              </button>
              <button 
                onClick={() => setIsOpen(false)}
                className="bg-blue-500 text-white px-4 py-2 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </ModalEventCatcher>
      )}
    </>
  )
} 