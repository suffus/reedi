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
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Sophisticated background pattern inspired by neemlondon.com */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-primary-50 opacity-60"></div>
      
      {/* Subtle geometric pattern overlay */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-full h-full" 
             style={{
               backgroundImage: `
                 linear-gradient(45deg, #171717 25%, transparent 25%), 
                 linear-gradient(-45deg, #171717 25%, transparent 25%), 
                 linear-gradient(45deg, transparent 75%, #171717 75%), 
                 linear-gradient(-45deg, transparent 75%, #171717 75%)
               `,
               backgroundSize: '60px 60px',
               backgroundPosition: '0 0, 0 30px, 30px -30px, -30px 0px'
             }}>
        </div>
      </div>
      
      {/* Floating accent elements */}
      <div className="absolute top-20 right-20 w-64 h-64 bg-primary-100 rounded-none opacity-20 transform rotate-12"></div>
      <div className="absolute bottom-40 left-20 w-48 h-48 bg-primary-100 rounded-none opacity-15 transform -rotate-6"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-50 rounded-none opacity-10"></div>
      
      <Header />
      
      <main className="relative z-10">
        <HeroSection />
        
        <section className="section-padding bg-white/80 backdrop-blur-sm relative">
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