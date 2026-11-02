import { Text, TextProps } from 'react-native'
import React from 'react'
import styles from './style'

const AppText = ({ style, children, ...rest }: TextProps) => {
  return (
    <Text style={[styles.text, style]} {...rest}>
      {children}
    </Text>
  )
}

export default AppText
