import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DashboardPage from '../../app/dashboard/page'
import { MediaDetailProvider } from '../../components/common/media-detail-context'

// Mock the DashboardWrapper component and all its dependencies
jest.mock('../../components/dashboard/dashboard-wrapper', () => ({
  DashboardWrapper: () => (
    <div data-testid="dashboard-wrapper">
      <div data-testid="personal-feed">Personal Feed</div>
      <div data-testid="user-gallery">User Gallery</div>
      <div data-testid="profile-editor">Profile Editor</div>
    </div>
  ),
}))

// Mock the MessagingProvider
jest.mock('../../lib/messaging-context', () => ({
  MessagingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
      <MediaDetailProvider>
        {component}
      </MediaDetailProvider>
    </QueryClientProvider>
  )
}

describe('Dashboard Page', () => {
  it('renders dashboard wrapper', () => {
    renderWithProviders(<DashboardPage />)
    
    expect(screen.getByTestId('dashboard-wrapper')).toBeInTheDocument()
  })

  it('renders personal feed component', () => {
    renderWithProviders(<DashboardPage />)
    
    expect(screen.getByTestId('personal-feed')).toBeInTheDocument()
  })

  it('renders user gallery component', () => {
    renderWithProviders(<DashboardPage />)
    
    expect(screen.getByTestId('user-gallery')).toBeInTheDocument()
  })

  it('renders profile editor component', () => {
    renderWithProviders(<DashboardPage />)
    
    expect(screen.getByTestId('profile-editor')).toBeInTheDocument()
  })

  it('has correct page structure', () => {
    renderWithProviders(<DashboardPage />)
    
    // Check that all main components are present
    expect(screen.getByTestId('dashboard-wrapper')).toBeInTheDocument()
    expect(screen.getByTestId('personal-feed')).toBeInTheDocument()
    expect(screen.getByTestId('user-gallery')).toBeInTheDocument()
    expect(screen.getByTestId('profile-editor')).toBeInTheDocument()
  })
}) 