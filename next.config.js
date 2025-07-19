/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://reedi.vib3cod3r.com/api'
  },
  // Suppress React internal warnings in development
  webpack: (config, { dev }) => {
    if (dev) {
      config.ignoreWarnings = [
        /Expected static flag was missing/,
        /Please notify the React team/
      ]
    }
    return config
  }
}

module.exports = nextConfig 
