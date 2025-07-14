'use client'

import React, { useState } from 'react'
import { LazyImage } from './lazy-image'
import { ProgressiveImage } from './progressive-image'

export function ProgressiveDemo() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  // Demo images (you can replace these with your actual image URLs)
  const demoImages = [
    {
      id: '1',
      src: 'https://picsum.photos/800/600?random=1',
      thumbnail: 'https://picsum.photos/300/200?random=1',
      title: 'Demo Image 1'
    },
    {
      id: '2',
      src: 'https://picsum.photos/800/600?random=2',
      thumbnail: 'https://picsum.photos/300/200?random=2',
      title: 'Demo Image 2'
    },
    {
      id: '3',
      src: 'https://picsum.photos/800/600?random=3',
      thumbnail: 'https://picsum.photos/300/200?random=3',
      title: 'Demo Image 3'
    }
  ]

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Progressive Image Loading Demo
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          This demo showcases the progressive loading effects for images. 
          Notice how images load with a blur effect that gradually sharpens, 
          providing immediate visual feedback while the full image downloads.
        </p>
      </div>

      {/* LazyImage Demo */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800">LazyImage with Progressive Effects</h2>
        <p className="text-gray-600">
          These images use lazy loading with progressive effects. They only load when scrolled into view.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {demoImages.map((image) => (
            <div key={image.id} className="space-y-2">
              <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                <LazyImage
                  src={image.src}
                  alt={image.title}
                  className="w-full h-full object-cover"
                  showProgressiveEffect={true}
                  onClick={() => setSelectedImage(image.src)}
                />
              </div>
              <h3 className="font-medium text-gray-900">{image.title}</h3>
              <p className="text-sm text-gray-500">
                Click to view full size with progressive loading
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ProgressiveImage Demo */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800">ProgressiveImage for Full-Size View</h2>
        <p className="text-gray-600">
          This demonstrates the full progressive loading experience with quality indicators.
        </p>
        
        <div className="max-w-2xl mx-auto">
          <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
            <ProgressiveImage
              src={selectedImage || demoImages[0].src}
              thumbnailSrc={selectedImage ? undefined : demoImages[0].thumbnail}
              alt="Full-size progressive image"
              className="w-full h-full object-cover"
              showQualityIndicator={true}
              showBlurEffect={true}
            />
          </div>
        </div>
      </div>

      {/* Performance Comparison */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800">Performance Benefits</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 p-6 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Immediate Feedback</h3>
            <p className="text-blue-700 text-sm">
              Users see content immediately, even on slow connections
            </p>
          </div>
          <div className="bg-green-50 p-6 rounded-lg">
            <h3 className="font-semibold text-green-900 mb-2">Progressive Quality</h3>
            <p className="text-green-700 text-sm">
              Image quality improves gradually as more data loads
            </p>
          </div>
          <div className="bg-purple-50 p-6 rounded-lg">
            <h3 className="font-semibold text-purple-900 mb-2">Better UX</h3>
            <p className="text-purple-700 text-sm">
              Reduced bounce rates and improved user engagement
            </p>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-3">How to Test</h3>
        <ul className="text-sm text-gray-700 space-y-2">
          <li>• Scroll down to see lazy loading in action</li>
          <li>• Click on images to see full-size progressive loading</li>
          <li>• Try throttling your network in DevTools to see the effect on slow connections</li>
          <li>• Notice the blur effect that gradually sharpens</li>
          <li>• Watch the quality indicator show loading progress</li>
        </ul>
      </div>
    </div>
  )
} 