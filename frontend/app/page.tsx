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
    <div className="min-h-screen bg-white relative">
      {/* Simplified background - removed complex patterns and transforms */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-primary-50 opacity-40"></div>
      
      {/* Performance-optimized chequered pattern */}
      <div className="absolute inset-0 opacity-5 chequered-pattern"></div>
      
      <Header />
      
      <main className="relative z-10">
        <HeroSection />
        
        <section className="section-padding bg-white/90 relative">
          <div className="container-max">
            <div className="grid lg:grid-cols-2 gap-16 items-start">
              <div className="space-y-8">
                <div>
                  <h2 className="text-4xl font-serif font-semibold text-primary-900 mb-6">
                    Latest Stories
                  </h2>
                  <p className="text-xl text-primary-600 mb-8 leading-relaxed">
                    Discover what your family and friends have been sharing
                  </p>
                </div>
                
                <Suspense fallback={<div className="space-y-4 text-primary-600">Loading posts...</div>}>
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