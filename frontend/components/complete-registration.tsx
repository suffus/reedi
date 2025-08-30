'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Mail, RefreshCw, CheckCircle, XCircle, ArrowLeft } from 'lucide-react'
import { useVerifyEmail, useResendVerification } from '@/lib/api-hooks'

interface CompleteRegistrationProps {
  userData: {
    id: string
    email: string
    name: string
  }
  onVerificationSuccess: (userData: any) => void
  onBack: () => void
}

export function CompleteRegistration({ 
  userData, 
  onVerificationSuccess, 
  onBack 
}: CompleteRegistrationProps) {
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', ''])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [timeLeft, setTimeLeft] = useState(15 * 60) // 15 minutes in seconds
  const [canResend, setCanResend] = useState(false)
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  
  const verifyEmailMutation = useVerifyEmail()
  const resendVerificationMutation = useResendVerification()

  // Countdown timer
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => prev - 1)
      }, 1000)
      return () => clearInterval(timer)
    } else {
      setCanResend(true)
    }
  }, [timeLeft])

  // Auto-focus next input when typing
  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) return // Prevent multiple characters
    
    const newCode = [...verificationCode]
    newCode[index] = value
    setVerificationCode(newCode)

    // Move to next input if value was entered
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  // Handle backspace
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      const newCode = [...verificationCode]
      newCode[index - 1] = ''
      setVerificationCode(newCode)
      inputRefs.current[index - 1]?.focus()
    }
  }

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').slice(0, 6)
    if (/^\d{6}$/.test(pastedData)) {
      const newCode = [...verificationCode]
      pastedData.split('').forEach((char, index) => {
        if (index < 6) newCode[index] = char
      })
      setVerificationCode(newCode)
      // Focus last filled input or first empty one
      const lastFilledIndex = Math.min(pastedData.length - 1, 5)
      inputRefs.current[lastFilledIndex]?.focus()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const code = verificationCode.join('')
    if (code.length !== 6) return

    setIsSubmitting(true)
    try {
      const result = await verifyEmailMutation.mutateAsync({ email: userData.email, code })
      onVerificationSuccess(result.data)
    } catch (error) {
      // Error is handled by the mutation
      console.error('Verification failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResendCode = async () => {
    try {
      await resendVerificationMutation.mutateAsync({ email: userData.email })
      setTimeLeft(15 * 60) // Reset timer
      setCanResend(false)
      setVerificationCode(['', '', '', '', '', '']) // Clear code
      inputRefs.current[0]?.focus() // Focus first input
    } catch (error) {
      console.error('Failed to resend code:', error)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const isCodeComplete = verificationCode.every(digit => digit !== '')

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-md mx-auto"
    >
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Complete Your Registration</h2>
        <p className="text-gray-600">
          Welcome back, <span className="font-semibold text-gray-900">{userData.name}</span>!
        </p>
        <p className="text-gray-600 mt-2">
          Please verify your email address to complete your account setup.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Enter the 6-digit code sent to <span className="font-semibold">{userData.email}</span>
          </label>
          <div className="flex justify-center space-x-2">
            {verificationCode.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={e => handleCodeChange(index, e.target.value)}
                onKeyDown={e => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="w-12 h-12 text-center text-lg font-semibold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                placeholder="0"
              />
            ))}
          </div>
        </div>

        {/* Timer and Resend */}
        <div className="text-center">
          {timeLeft > 0 ? (
            <p className="text-sm text-gray-500">
              Code expires in <span className="font-mono font-semibold">{formatTime(timeLeft)}</span>
            </p>
          ) : (
            <p className="text-sm text-red-500">Code has expired</p>
          )}
          
          <button
            type="button"
            onClick={handleResendCode}
            disabled={!canResend || resendVerificationMutation.isPending}
            className={`mt-2 text-sm font-medium transition-colors ${
              canResend 
                ? 'text-blue-600 hover:text-blue-700' 
                : 'text-gray-400 cursor-not-allowed'
            }`}
          >
            {resendVerificationMutation.isPending ? (
              <RefreshCw className="w-4 h-4 inline animate-spin mr-1" />
            ) : (
              <RefreshCw className="w-4 h-4 inline mr-1" />
            )}
            Resend Code
          </button>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isCodeComplete || isSubmitting}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
            isCodeComplete && !isSubmitting
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Verifying...
            </div>
          ) : (
            'Complete Registration'
          )}
        </button>

        {/* Back Button */}
        <button
          type="button"
          onClick={onBack}
          className="w-full py-2 px-4 text-gray-600 hover:text-gray-800 transition-colors flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Login
        </button>
      </form>

      {/* Error Messages */}
      {verifyEmailMutation.error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center"
        >
          <XCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" />
          <span className="text-sm text-red-700">
            {verifyEmailMutation.error.message}
          </span>
        </motion.div>
      )}

      {/* Success Message */}
      {verifyEmailMutation.isSuccess && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center"
        >
          <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
          <span className="text-sm text-green-700">
            Email verified successfully! Logging you in...
          </span>
        </motion.div>
      )}

      {/* Help Text */}
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>Didn't receive the email? Check your spam folder.</p>
        <p className="mt-1">The code will expire in 15 minutes for security.</p>
      </div>
    </motion.div>
  )
} 