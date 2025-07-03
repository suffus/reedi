'use client'

import { motion } from 'framer-motion'
import { Heart, Users, Shield, Camera } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="relative section-padding overflow-hidden">
      <div className="container-max relative z-10">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-12"
          >
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-serif font-semibold text-primary-900 mb-8 text-balance">
              Connect with{' '}
              <span className="text-primary-600">Family & Friends</span>
            </h1>
            <p className="text-xl sm:text-2xl text-primary-600 max-w-4xl mx-auto leading-relaxed text-balance">
              A secure, private social platform designed for meaningful connections. 
              Share moments, stories, and stay close with the people who matter most.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-6 justify-center mb-20"
          >
            <button className="btn-primary text-lg px-10 py-4 shadow-lg">
              Get Started Free
            </button>
            <button className="btn-secondary text-lg px-10 py-4 shadow-lg">
              Learn More
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto"
          >
            <div className="text-center">
              <div className="bg-white/90 backdrop-blur-sm w-20 h-20 rounded-none flex items-center justify-center mx-auto mb-6 border border-primary-200 shadow-lg">
                <Shield className="h-10 w-10 text-primary-900" />
              </div>
              <h3 className="text-xl font-semibold text-primary-900 mb-4">Secure & Private</h3>
              <p className="text-primary-600 leading-relaxed">Your data stays private and secure with end-to-end encryption</p>
            </div>
            
            <div className="text-center">
              <div className="bg-white/90 backdrop-blur-sm w-20 h-20 rounded-none flex items-center justify-center mx-auto mb-6 border border-primary-200 shadow-lg">
                <Users className="h-10 w-10 text-primary-900" />
              </div>
              <h3 className="text-xl font-semibold text-primary-900 mb-4">Family Focused</h3>
              <p className="text-primary-600 leading-relaxed">Designed specifically for families and close friends</p>
            </div>
            
            <div className="text-center">
              <div className="bg-white/90 backdrop-blur-sm w-20 h-20 rounded-none flex items-center justify-center mx-auto mb-6 border border-primary-200 shadow-lg">
                <Camera className="h-10 w-10 text-primary-900" />
              </div>
              <h3 className="text-xl font-semibold text-primary-900 mb-4">Rich Media</h3>
              <p className="text-primary-600 leading-relaxed">Share photos, videos, and stories with beautiful galleries</p>
            </div>
          </motion.div>
        </div>
      </div>
      
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-100 rounded-none opacity-30"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-100 rounded-none opacity-30"></div>
      </div>
    </section>
  )
} 