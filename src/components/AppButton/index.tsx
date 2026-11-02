import { ActivityIndicator, StyleProp, TextStyle, TouchableOpacity, TouchableOpacityProps } from 'react-native'
import React from 'react'
import AppText from '../AppText'
import colors from '../../constants/colors'
import styles from './style'

type AppButtonProps = TouchableOpacityProps & {
  title: string
  loading?: boolean
  textStyle?: StyleProp<TextStyle>
}

const AppButton = ({ title, loading, disabled, style, textStyle, ...rest }: AppButtonProps) => {
  const isDisabled = disabled || loading

  return (
    <TouchableOpacity
      style={[styles.button, isDisabled && styles.disabled, style]}
      disabled={isDisabled}
      activeOpacity={0.8}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <AppText style={[styles.text, textStyle]}>{title}</AppText>
      )}
    </TouchableOpacity>
  )
}

export default AppButton
