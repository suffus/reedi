import { DashboardWrapper } from '../../components/dashboard/dashboard-wrapper'
import { MessagingProvider } from '../../lib/messaging-context'

export default function DashboardPage() {
  return (
    <MessagingProvider>
      <DashboardWrapper />
    </MessagingProvider>
  )
} 