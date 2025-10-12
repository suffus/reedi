import { getImageUrl } from '../../lib/api'

describe('API Utils', () => {
  describe('getImageUrl', () => {
    it('should handle relative paths', () => {
      // The function will use whatever IMAGE_BASE_URL is configured
      // We just test that it properly constructs URLs
      const result = getImageUrl('/uploads/image.jpg')
      // Should return either a full URL or the relative path
      expect(result).toContain('image.jpg')
      expect(result).toContain('/uploads/')
    })

    it('should return the same URL when given a full URL', () => {
      const fullUrl = 'https://example.com/image.jpg'
      const result = getImageUrl(fullUrl)
      expect(result).toBe(fullUrl)
    })

    it('should handle full URLs with http', () => {
      const fullUrl = 'http://example.com/image.jpg'
      const result = getImageUrl(fullUrl)
      expect(result).toBe(fullUrl)
    })

    it('should handle empty string input', () => {
      const result = getImageUrl('')
      expect(result).toBe('')
    })

    it('should handle null input', () => {
      const result = getImageUrl(null as any)
      expect(result).toBe('')
    })

    it('should handle data URLs', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg'
      const result = getImageUrl(dataUrl)
      expect(result).toBe(dataUrl)
    })
  })
}) 