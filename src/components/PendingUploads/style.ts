import { StyleSheet } from 'react-native'
import colors from '../../constants/colors'

const styles = StyleSheet.create({
  container: {
    marginTop: 28,
  },
  heading: {
    fontWeight: '600',
    marginBottom: 8,
  },
  item: {
    padding: 12,
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  itemHeader: {
    alignItems: 'center',
    gap: 10,
  },
  description: {
    fontWeight: '600',
  },
  status: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textLight,
  },
  statusError: {
    color: colors.error,
  },
  retry: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.secondaryLight,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  progress: {
    marginTop: 10,
  },
})

export default styles
