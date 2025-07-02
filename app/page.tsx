"use client"
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { HeroSection } from '../components/hero-section'
import { LatestPosts } from '../components/latest-posts'
import { AuthSection } from '../components/auth-section'
import { Header } from '../components/header'
import { Footer } from '../components/footer'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token')
      if (token) {
        router.replace('/dashboard')
      }
    }
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-indigo-100">
      <Header />
      
      <main>
        <HeroSection />
        
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-serif font-bold text-gray-900 mb-4">
                    Latest Stories
                  </h2>
                  <p className="text-lg text-gray-600 mb-8">
                    Discover what your family and friends have been sharing
                  </p>
                </div>
                
                <Suspense fallback={<div className="space-y-4">Loading posts...</div>}>
                  <LatestPosts />
                </Suspense>
              </div>
              
              <div className="lg:sticky lg:top-8">
                <AuthSection />
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  )
} 