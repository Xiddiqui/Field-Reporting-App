import { StyleSheet } from 'react-native'
import colors from '../../constants/colors'

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  item: {
    padding: 12,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  itemHeader: {
    gap: 12,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: colors.secondaryLight,
  },
  description: {
    fontWeight: '600',
  },
  meta: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textLight,
  },
  statusRow: {
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  detail: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textLight,
  },
  detailError: {
    color: colors.error,
  },
  progress: {
    marginTop: 10,
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    minHeight: 44,
    marginTop: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.secondaryLight,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
})

export default styles
