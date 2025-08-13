'use client'

import React from 'react'
import GroupProfile from '@/components/group-profile'
import { useAuth } from '@/lib/api-hooks'

const GroupPage: React.FC = () => {
  const { data: authData, isLoading: authLoading } = useAuth()
  const currentUser = authData?.data?.user

  console.log('GroupPage: Auth data:', authData)
  console.log('GroupPage: Current user:', currentUser)
  console.log('GroupPage: Auth loading:', authLoading)

  return <GroupProfile currentUser={currentUser} />
}

export default GroupPage 