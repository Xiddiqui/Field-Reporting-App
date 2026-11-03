import AppNavigator from "./src/navigation";

import { SafeAreaProvider } from 'react-native-safe-area-context'
import React, { useEffect } from 'react'
import { startUploadQueue } from './src/services/uploadQueue'

const App = () => {
  // Resumes any reports left in the offline queue and uploads them whenever the device is online
  useEffect(() => startUploadQueue(), [])

  return (
    <SafeAreaProvider>
      <AppNavigator/>
    </SafeAreaProvider>
  )
}

export default App
