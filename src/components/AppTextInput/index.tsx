import { TextInput, TextInputProps } from 'react-native'
import React from 'react'
import AppText from '../AppText'
import AppView from '../AppView'
import colors from '../../constants/colors'
import styles from './style'

type AppTextInputProps = TextInputProps & {
  label?: string
  error?: string
}

const AppTextInput = ({ label, error, multiline, style, ...rest }: AppTextInputProps) => {
  return (
    <AppView>
      {label ? <AppText style={styles.label}>{label}</AppText> : null}
      <TextInput
        style={[
          styles.input,
          multiline && styles.multiline,
          !!error && styles.inputError,
          style,
        ]}
        placeholderTextColor={colors.textLight}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...rest}
      />
      {error ? <AppText style={styles.error}>{error}</AppText> : null}
    </AppView>
  )
}

export default AppTextInput
