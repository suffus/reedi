/// This file provides a wrapper to bring a component to the front at full screen

import { ReactNode } from "react"

export function FullScreenWrapper({ children }: { children: ReactNode }) {

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      {children}
    </div>
  )
}