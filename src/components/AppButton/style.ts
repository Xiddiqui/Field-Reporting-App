import { StyleSheet } from 'react-native'
import colors from '../../constants/colors'

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  disabled: {
    backgroundColor: colors.primaryLight,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
})

export default styles
