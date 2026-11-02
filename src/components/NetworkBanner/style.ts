import { StyleSheet } from 'react-native'
import colors from '../../constants/colors'

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  offline: {
    backgroundColor: colors.error,
  },
  online: {
    backgroundColor: colors.success,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.white,
  },
})

export default styles
