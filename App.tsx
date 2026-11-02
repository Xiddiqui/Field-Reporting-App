import Dashboard from "./src/screens/dashboard";

import { SafeAreaProvider } from 'react-native-safe-area-context'
import React, { useEffect } from 'react'
import { startUploadQueue } from './src/services/uploadQueue'

const App = () => {
  // Resumes any reports left in the offline queue and uploads them whenever the device is online
  useEffect(() => startUploadQueue(), [])

  return (
    <SafeAreaProvider>
      <Dashboard/>
    </SafeAreaProvider>
  )
}

export default App
