import React from 'react'
import { render, screen } from '@testing-library/react'
import DashboardPage from '../../app/dashboard/page'

// Mock the components
jest.mock('../../components/dashboard/dashboard-wrapper', () => ({
  DashboardWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-wrapper">
      {children}
    </div>
  ),
}))

jest.mock('../../components/dashboard/personal-feed', () => ({
  PersonalFeed: () => <div data-testid="personal-feed">Personal Feed</div>,
}))

jest.mock('../../components/dashboard/user-gallery', () => ({
  UserGallery: () => <div data-testid="user-gallery">User Gallery</div>,
}))

jest.mock('../../components/dashboard/profile-editor', () => ({
  ProfileEditor: () => <div data-testid="profile-editor">Profile Editor</div>,
}))

describe('Dashboard Page', () => {
  it('renders dashboard wrapper', () => {
    render(<DashboardPage />)
    
    expect(screen.getByTestId('dashboard-wrapper')).toBeInTheDocument()
  })

  it('renders personal feed component', () => {
    render(<DashboardPage />)
    
    expect(screen.getByTestId('personal-feed')).toBeInTheDocument()
  })

  it('renders user gallery component', () => {
    render(<DashboardPage />)
    
    expect(screen.getByTestId('user-gallery')).toBeInTheDocument()
  })

  it('renders profile editor component', () => {
    render(<DashboardPage />)
    
    expect(screen.getByTestId('profile-editor')).toBeInTheDocument()
  })

  it('has correct page structure', () => {
    render(<DashboardPage />)
    
    // Check that all main components are present
    expect(screen.getByTestId('dashboard-wrapper')).toBeInTheDocument()
    expect(screen.getByTestId('personal-feed')).toBeInTheDocument()
    expect(screen.getByTestId('user-gallery')).toBeInTheDocument()
    expect(screen.getByTestId('profile-editor')).toBeInTheDocument()
  })
}) 