import { getImageUrl } from '../../lib/api'

describe('API Utils', () => {
  describe('getImageUrl', () => {
    const originalEnv = process.env

    beforeEach(() => {
      jest.resetModules()
      process.env = { ...originalEnv }
    })

    afterAll(() => {
      process.env = originalEnv
    })

    it('should return full URL when given a relative path', () => {
      process.env.NEXT_PUBLIC_BACKEND_URL = 'http://localhost:8088'
      process.env.NEXT_PUBLIC_IMAGE_BASE_URL = 'http://localhost:8088/uploads'
      
      const result = getImageUrl('/uploads/image.jpg')
      expect(result).toBe('http://localhost:8088/uploads/image.jpg')
    })

    it('should return the same URL when given a full URL', () => {
      const fullUrl = 'https://example.com/image.jpg'
      const result = getImageUrl(fullUrl)
      expect(result).toBe(fullUrl)
    })

    it('should handle undefined environment variables gracefully', () => {
      delete process.env.NEXT_PUBLIC_BACKEND_URL
      delete process.env.NEXT_PUBLIC_IMAGE_BASE_URL
      
      const result = getImageUrl('/uploads/image.jpg')
      expect(result).toBe('/uploads/image.jpg')
    })

    it('should handle empty string input', () => {
      const result = getImageUrl('')
      expect(result).toBe('')
    })

    it('should handle null input', () => {
      const result = getImageUrl(null as any)
      expect(result).toBe('')
    })
  })
}) 