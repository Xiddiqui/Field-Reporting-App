import AppNavigator from "./src/navigation";

import { SafeAreaProvider } from 'react-native-safe-area-context'
import React, { useEffect } from 'react'
import { startDelivery } from './src/delivery/deliveryService'

const App = () => {
  // Repairs interrupted work, then resumes photo processing and uploads whenever possible
  useEffect(() => startDelivery(), [])

  return (
    <SafeAreaProvider>
      <AppNavigator/>
    </SafeAreaProvider>
  )
}

export default App
