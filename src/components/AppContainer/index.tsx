import { SafeAreaView, SafeAreaViewProps } from 'react-native-safe-area-context'
import React from 'react'
import styles from './style'

const AppContainer = ({ style, children, ...rest }: SafeAreaViewProps) => {
  return (
    <SafeAreaView style={[styles.container, style]} {...rest}>
      {children}
    </SafeAreaView>
  )
}

export default AppContainer
