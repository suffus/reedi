import React from 'react'
import { render, screen } from '@testing-library/react'
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

describe('Home Page', () => {
  it('renders header component', () => {
    render(<HomePage />)
    
    expect(screen.getByTestId('header')).toBeInTheDocument()
  })

  it('renders hero section component', () => {
    render(<HomePage />)
    
    expect(screen.getByTestId('hero-section')).toBeInTheDocument()
  })

  it('renders latest posts component', () => {
    render(<HomePage />)
    
    expect(screen.getByTestId('latest-posts')).toBeInTheDocument()
  })

  it('renders footer component', () => {
    render(<HomePage />)
    
    expect(screen.getByTestId('footer')).toBeInTheDocument()
  })

  it('has correct page structure', () => {
    render(<HomePage />)
    
    // Check that all main components are present
    expect(screen.getByTestId('header')).toBeInTheDocument()
    expect(screen.getByTestId('hero-section')).toBeInTheDocument()
    expect(screen.getByTestId('latest-posts')).toBeInTheDocument()
    expect(screen.getByTestId('footer')).toBeInTheDocument()
  })

  it('renders components in correct order', () => {
    render(<HomePage />)
    
    const container = screen.getByTestId('header').parentElement
    const children = Array.from(container?.children || [])
    
    // Check order: header, hero, latest posts, footer
    expect(children[0]).toHaveAttribute('data-testid', 'header')
    expect(children[1]).toHaveAttribute('data-testid', 'hero-section')
    expect(children[2]).toHaveAttribute('data-testid', 'latest-posts')
    expect(children[3]).toHaveAttribute('data-testid', 'footer')
  })
}) 