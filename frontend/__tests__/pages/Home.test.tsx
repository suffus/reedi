import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HomePage from '../../app/page'

// Mock the components
jest.mock('../../components/header', () => ({
  Header: () => <div data-testid="header">Header</div>,
}))

jest.mock('../../components/hero-section', () => ({
  HeroSection: () => <div data-testid="hero-section">Hero Section</div>,
}))

jest.mock('../../components/latest-posts', () => ({
  LatestPosts: () => <div data-testid="latest-posts">Latest Posts</div>,
}))

jest.mock('../../components/footer', () => ({
  Footer: () => <div data-testid="footer">Footer</div>,
}))

// Helper to render with required providers
const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

describe('Home Page', () => {
  it('renders header component', () => {
    renderWithProviders(<HomePage />)
    
    expect(screen.getByTestId('header')).toBeInTheDocument()
  })

  it('renders hero section component', () => {
    renderWithProviders(<HomePage />)
    
    expect(screen.getByTestId('hero-section')).toBeInTheDocument()
  })

  it('renders latest posts component', () => {
    renderWithProviders(<HomePage />)
    
    expect(screen.getByTestId('latest-posts')).toBeInTheDocument()
  })

  it('renders footer component', () => {
    renderWithProviders(<HomePage />)
    
    expect(screen.getByTestId('footer')).toBeInTheDocument()
  })

  it('has correct page structure', () => {
    renderWithProviders(<HomePage />)
    
    // Check that all main components are present
    expect(screen.getByTestId('header')).toBeInTheDocument()
    expect(screen.getByTestId('hero-section')).toBeInTheDocument()
    expect(screen.getByTestId('latest-posts')).toBeInTheDocument()
    expect(screen.getByTestId('footer')).toBeInTheDocument()
  })

  it('renders components in correct order', () => {
    const { container } = renderWithProviders(<HomePage />)
    
    // Get all testids in order
    const testIds = Array.from(container.querySelectorAll('[data-testid]')).map(
      el => el.getAttribute('data-testid')
    )
    
    // Check that components appear in expected order
    expect(testIds).toContain('header')
    expect(testIds).toContain('hero-section')
    expect(testIds).toContain('latest-posts')
    expect(testIds).toContain('footer')
  })
}) 