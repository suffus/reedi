'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Heart, Menu, X } from 'lucide-react'
import { useState } from 'react'

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="relative z-50 bg-white/95 backdrop-blur-md border-b border-primary-100">
      <div className="container-max px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="flex items-center space-x-3"
            >
              <Heart className="h-8 w-8 text-primary-900" />
              <span className="text-2xl font-serif font-semibold text-primary-900">
                Reedi
              </span>
            </motion.div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-12">
            <Link 
              href="/about" 
              className="text-primary-600 hover:text-primary-900 transition-colors duration-300 font-medium"
            >
              About
            </Link>
            <Link 
              href="/features" 
              className="text-primary-600 hover:text-primary-900 transition-colors duration-300 font-medium"
            >
              Features
            </Link>
            <Link 
              href="/contact" 
              className="text-primary-600 hover:text-primary-900 transition-colors duration-300 font-medium"
            >
              Contact
            </Link>
            <Link 
              href="/dashboard" 
              className="btn-outline"
            >
              Dashboard
            </Link>
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-none text-primary-600 hover:text-primary-900 hover:bg-primary-50 transition-colors duration-300"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden py-6 border-t border-primary-100"
          >
            <nav className="flex flex-col space-y-6">
              <Link 
                href="/about" 
                className="text-primary-600 hover:text-primary-900 transition-colors duration-300 font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                About
              </Link>
              <Link 
                href="/features" 
                className="text-primary-600 hover:text-primary-900 transition-colors duration-300 font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                Features
              </Link>
              <Link 
                href="/contact" 
                className="text-primary-600 hover:text-primary-900 transition-colors duration-300 font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                Contact
              </Link>
              <Link 
                href="/dashboard" 
                className="btn-outline w-full text-center"
                onClick={() => setIsMenuOpen(false)}
              >
                Dashboard
              </Link>
            </nav>
          </motion.div>
        )}
      </div>
    </header>
  )
} 