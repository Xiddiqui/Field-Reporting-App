import { StyleProp, ViewStyle } from 'react-native'
import React from 'react'
import AppView from '../AppView'
import styles from './style'

type ProgressBarProps = {
  // Between 0 and 1
  progress: number
  color?: string
  style?: StyleProp<ViewStyle>
}

const ProgressBar = ({ progress, color, style }: ProgressBarProps) => {
  const percent = Math.round(Math.max(0, Math.min(progress, 1)) * 100)

  return (
    <AppView style={[styles.track, style]}>
      <AppView style={[styles.fill, { width: `${percent}%` }, !!color && { backgroundColor: color }]} />
    </AppView>
  )
}

export default ProgressBar
