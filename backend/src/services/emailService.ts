import nodemailer from 'nodemailer'
import { logger } from '@/utils/logger'

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null

  constructor() {
    this.initializeTransporter()
  }

  private initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })

      // Verify connection configuration
      this.transporter!.verify((error) => {
        if (error) {
          logger.error('SMTP connection error:', error)
        } else {
          logger.info('SMTP server is ready to send emails')
        }
      })
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error)
      this.transporter = null
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      logger.error('Email transporter not initialized')
      return false
    }

    try {
      const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'Reedi'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      }

      const info = await this.transporter.sendMail(mailOptions)
      logger.info('Email sent successfully:', info.messageId)
      return true
    } catch (error) {
      logger.error('Failed to send email:', error)
      return false
    }
  }

  async sendVerificationEmail(email: string, code: string, name: string): Promise<boolean> {
    const subject = 'Verify Your Email Address - Reedi'
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; }
          .code { background: #e9ecef; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0; border-radius: 8px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 14px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Reedi!</h1>
          </div>
          
          <p>Hi ${name},</p>
          
          <p>Thank you for creating your Reedi account! To complete your registration, please verify your email address by entering the following verification code:</p>
          
          <div class="code">${code}</div>
          
          <p>This code will expire in 15 minutes for security reasons.</p>
          
          <p>If you didn't create this account, you can safely ignore this email.</p>
          
          <div class="footer">
            <p>Best regards,<br>The Reedi Team</p>
            <p><small>This is an automated message, please do not reply to this email.</small></p>
          </div>
        </div>
      </body>
      </html>
    `

    return this.sendEmail({
      to: email,
      subject,
      html,
    })
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  }
}

export const emailService = new EmailService() 