'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Mail, Lock, User, ArrowRight } from 'lucide-react'
import { useLogin, useRegister } from '../lib/api-hooks'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type LoginForm = z.infer<typeof loginSchema>
type SignupForm = z.infer<typeof signupSchema>

export function AuthSection() {
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const signupForm = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  })

  const loginMutation = useLogin()
  const registerMutation = useRegister()

  const onLoginSubmit = async (data: LoginForm) => {
    try {
      console.log('Attempting login with:', data.email)
      
      const result = await loginMutation.mutateAsync(data)
      console.log('Login successful:', result)
      
      // Redirect to dashboard
      window.location.href = '/dashboard'
    } catch (error) {
      console.error('Login error:', error)
      alert(error instanceof Error ? error.message : 'An error occurred during login. Please try again.')
    }
  }

  const onSignupSubmit = async (data: SignupForm) => {
    try {
      const result = await registerMutation.mutateAsync({
        name: data.name,
        email: data.email,
        password: data.password,
      })

      console.log('Signup successful:', result)
      
      // Redirect to dashboard
      window.location.href = '/dashboard'
    } catch (error) {
      console.error('Signup error:', error)
      alert(error instanceof Error ? error.message : 'An error occurred during signup. Please try again.')
    }
  }

  const isLoading = loginMutation.isPending || registerMutation.isPending

  return (
    <div className="card-elevated max-w-md mx-auto bg-white/95 backdrop-blur-md shadow-2xl border-primary-100">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-serif font-semibold text-primary-900 mb-4">
          {isLogin ? 'Welcome Back' : 'Join Reedi'}
        </h2>
        <p className="text-primary-600 leading-relaxed">
          {isLogin ? 'Sign in to your account' : 'Create your account to get started'}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {isLogin ? (
          <motion.form
            key="login"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            onSubmit={loginForm.handleSubmit(onLoginSubmit)}
            className="space-y-6"
          >
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-primary-700 mb-3">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-primary-400" />
                <input
                  id="login-email"
                  type="email"
                  {...loginForm.register('email')}
                  className="input-field pl-12 bg-white/90 backdrop-blur-sm"
                  placeholder="Enter your email"
                />
              </div>
              {loginForm.formState.errors.email && (
                <p className="mt-2 text-sm text-red-600">{loginForm.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-primary-700 mb-3">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-primary-400" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  {...loginForm.register('password')}
                  className="input-field pl-12 pr-12 bg-white/90 backdrop-blur-sm"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-primary-400 hover:text-primary-600 transition-colors duration-300"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {loginForm.formState.errors.password && (
                <p className="mt-2 text-sm text-red-600">{loginForm.formState.errors.password.message}</p>
              )}
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed py-4 shadow-lg"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
              <ArrowRight className="ml-2 h-5 w-5" />
            </button>
          </motion.form>
        ) : (
          <motion.form
            key="signup"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            onSubmit={signupForm.handleSubmit(onSignupSubmit)}
            className="space-y-6"
          >
            <div>
              <label htmlFor="signup-name" className="block text-sm font-medium text-primary-700 mb-3">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-primary-400" />
                <input
                  id="signup-name"
                  type="text"
                  {...signupForm.register('name')}
                  className="input-field pl-12 bg-white/90 backdrop-blur-sm"
                  placeholder="Enter your full name"
                />
              </div>
              {signupForm.formState.errors.name && (
                <p className="mt-2 text-sm text-red-600">{signupForm.formState.errors.name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-primary-700 mb-3">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-primary-400" />
                <input
                  id="signup-email"
                  type="email"
                  {...signupForm.register('email')}
                  className="input-field pl-12 bg-white/90 backdrop-blur-sm"
                  placeholder="Enter your email"
                />
              </div>
              {signupForm.formState.errors.email && (
                <p className="mt-2 text-sm text-red-600">{signupForm.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="signup-password" className="block text-sm font-medium text-primary-700 mb-3">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-primary-400" />
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  {...signupForm.register('password')}
                  className="input-field pl-12 pr-12 bg-white/90 backdrop-blur-sm"
                  placeholder="Create a password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-primary-400 hover:text-primary-600 transition-colors duration-300"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {signupForm.formState.errors.password && (
                <p className="mt-2 text-sm text-red-600">{signupForm.formState.errors.password.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="signup-confirm-password" className="block text-sm font-medium text-primary-700 mb-3">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-primary-400" />
                <input
                  id="signup-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...signupForm.register('confirmPassword')}
                  className="input-field pl-12 pr-12 bg-white/90 backdrop-blur-sm"
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-primary-400 hover:text-primary-600 transition-colors duration-300"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {signupForm.formState.errors.confirmPassword && (
                <p className="mt-2 text-sm text-red-600">{signupForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed py-4 shadow-lg"
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
              <ArrowRight className="ml-2 h-5 w-5" />
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="mt-8 text-center">
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-primary-600 hover:text-primary-900 font-medium transition-colors duration-300"
        >
          {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
} 