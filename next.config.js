/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8089/api'
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