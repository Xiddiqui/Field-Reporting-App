import { View, ViewProps } from 'react-native'
import React from 'react'
import styles from './style'

type AppViewProps = ViewProps & {
  row?: boolean
  center?: boolean
  flex?: boolean
}

const AppView = ({ row, center, flex, style, children, ...rest }: AppViewProps) => {
  return (
    <View
      style={[
        row && styles.row,
        center && styles.center,
        flex && styles.flex,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  )
}

export default AppView
