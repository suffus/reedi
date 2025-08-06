'use client';

import React from 'react';
import { MessagingProvider } from '@/lib/messaging-context';
import { MessagingApp } from '@/components/messaging/messaging-app';

export default function MessagesPage() {
  return (
    <MessagingProvider>
      <MessagingApp />
    </MessagingProvider>
  );
} 