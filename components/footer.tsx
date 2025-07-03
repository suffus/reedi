'use client'

import Link from 'next/link'
import { Heart, Github, Twitter, Mail } from 'lucide-react'

export function Footer() {
  return (
    <footer className="bg-primary-900 text-white">
      <div className="container-max px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-3 mb-6">
              <Heart className="h-8 w-8 text-white" />
              <span className="text-2xl font-serif font-semibold">Reedi</span>
            </div>
            <p className="text-primary-200 mb-8 max-w-md leading-relaxed">
              A secure social platform designed for families and friends to stay connected, 
              share moments, and create lasting memories together.
            </p>
            <div className="flex space-x-6">
              <a href="#" className="text-primary-300 hover:text-white transition-colors duration-300">
                <Github className="h-6 w-6" />
              </a>
              <a href="#" className="text-primary-300 hover:text-white transition-colors duration-300">
                <Twitter className="h-6 w-6" />
              </a>
              <a href="#" className="text-primary-300 hover:text-white transition-colors duration-300">
                <Mail className="h-6 w-6" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-lg font-semibold mb-6">Product</h3>
            <ul className="space-y-4">
              <li>
                <Link href="/features" className="text-primary-300 hover:text-white transition-colors duration-300">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-primary-300 hover:text-white transition-colors duration-300">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/security" className="text-primary-300 hover:text-white transition-colors duration-300">
                  Security
                </Link>
              </li>
              <li>
                <Link href="/api" className="text-primary-300 hover:text-white transition-colors duration-300">
                  API
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-lg font-semibold mb-6">Company</h3>
            <ul className="space-y-4">
              <li>
                <Link href="/about" className="text-primary-300 hover:text-white transition-colors duration-300">
                  About
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-primary-300 hover:text-white transition-colors duration-300">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/careers" className="text-primary-300 hover:text-white transition-colors duration-300">
                  Careers
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-primary-300 hover:text-white transition-colors duration-300">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-primary-300 text-sm">
            © 2024 Reedi. All rights reserved.
          </p>
          <div className="flex space-x-8 mt-4 md:mt-0">
            <Link href="/privacy" className="text-primary-300 hover:text-white text-sm transition-colors duration-300">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-primary-300 hover:text-white text-sm transition-colors duration-300">
              Terms of Service
            </Link>
            <Link href="/cookies" className="text-primary-300 hover:text-white text-sm transition-colors duration-300">
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
} 