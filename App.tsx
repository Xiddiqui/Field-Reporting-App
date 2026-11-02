import Dashboard from "./src/screens/dashboard";

import { SafeAreaProvider } from 'react-native-safe-area-context'
import React from 'react'

const App = () => {
  return (
    <SafeAreaProvider>
      <Dashboard/>
    </SafeAreaProvider>
  )
}

export default App
