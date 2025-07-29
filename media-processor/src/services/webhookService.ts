import axios from 'axios'
import { createLogger } from '../utils/logger'
import { config } from '../utils/config'
import { WebhookPayload, ProcessingStatus } from '../types'
import crypto from 'crypto'

const logger = createLogger('webhookService')

export class WebhookService {
  private baseUrl: string
  private webhookSecret: string

  constructor() {
    this.baseUrl = config.api.baseUrl
    this.webhookSecret = config.api.webhookSecret
  }

  /**
   * Send processing status update to the main API
   */
  async sendStatusUpdate(mediaId: string, status: ProcessingStatus): Promise<void> {
    try {
      const payload: WebhookPayload = {
        mediaId,
        status,
        timestamp: new Date()
      }

      // Generate signature for security
      const signature = this.generateSignature(payload)
      payload.signature = signature

      const response = await axios.post(
        `${this.baseUrl}/api/media/${mediaId}/processing-status`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': this.webhookSecret,
            'X-Processing-Service': 'media-processor'
          },
          timeout: 10000 // 10 second timeout
        }
      )

      if (response.status === 200) {
        logger.info(`Status update sent successfully for media ${mediaId}`)
      } else {
        logger.warn(`Status update returned status ${response.status} for media ${mediaId}`)
      }
    } catch (error) {
      logger.error(`Failed to send status update for media ${mediaId}:`, error)
      throw new Error(`Webhook failed: ${error}`)
    }
  }

  /**
   * Send processing completion notification
   */
  async sendProcessingComplete(
    mediaId: string,
    outputs: any[],
    processingTime: number,
    metadata?: any
  ): Promise<void> {
    const status: ProcessingStatus = {
      status: 'COMPLETED',
      progress: 100,
      currentStep: 'completed',
      outputs,
      metadata
    }

    await this.sendStatusUpdate(mediaId, status)
  }

  /**
   * Send processing failure notification
   */
  async sendProcessingFailed(mediaId: string, error: string): Promise<void> {
    const status: ProcessingStatus = {
      status: 'FAILED',
      error
    }

    await this.sendStatusUpdate(mediaId, status)
  }

  /**
   * Send processing progress update
   */
  async sendProgressUpdate(
    mediaId: string,
    progress: number,
    currentStep: string
  ): Promise<void> {
    const status: ProcessingStatus = {
      status: 'PROCESSING',
      progress,
      currentStep
    }

    await this.sendStatusUpdate(mediaId, status)
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: WebhookPayload): string {
    const data = JSON.stringify(payload)
    return crypto
      .createHmac('sha256', this.webhookSecret)
      .update(data)
      .digest('hex')
  }

  /**
   * Test connection to the main API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/health`, {
        timeout: 5000
      })
      return response.status === 200
    } catch (error) {
      logger.error('Failed to connect to main API:', error)
      return false
    }
  }

  /**
   * Get media details from the main API
   */
  async getMediaDetails(mediaId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/media/${mediaId}`,
        {
          headers: {
            'X-Processing-Service': 'media-processor'
          },
          timeout: 10000
        }
      )

      if (response.status === 200) {
        return response.data.data.media
      } else {
        throw new Error(`API returned status ${response.status}`)
      }
    } catch (error) {
      logger.error(`Failed to get media details for ${mediaId}:`, error)
      throw new Error(`API request failed: ${error}`)
    }
  }

  /**
   * Update media record with processing results
   */
  async updateMediaRecord(mediaId: string, updates: any): Promise<void> {
    try {
      const response = await axios.put(
        `${this.baseUrl}/api/media/${mediaId}`,
        updates,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Processing-Service': 'media-processor'
          },
          timeout: 10000
        }
      )

      if (response.status === 200) {
        logger.info(`Media record updated successfully for ${mediaId}`)
      } else {
        logger.warn(`Media update returned status ${response.status} for ${mediaId}`)
      }
    } catch (error) {
      logger.error(`Failed to update media record for ${mediaId}:`, error)
      throw new Error(`Media update failed: ${error}`)
    }
  }
}

export const webhookService = new WebhookService()
export default webhookService 