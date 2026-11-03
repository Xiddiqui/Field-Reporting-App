import { StyleSheet } from 'react-native'
import colors from '../../constants/colors'

const styles = StyleSheet.create({
  list: {
    padding: 16,
    flexGrow: 1,
  },
  note: {
    marginBottom: 12,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textLight,
  },
  card: {
    padding: 14,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  description: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  meta: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 2,
  },
  images: {
    gap: 8,
    marginTop: 10,
  },
  image: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: colors.secondaryLight,
  },
  statePadding: {
    padding: 24,
  },
  stateTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateText: {
    marginTop: 6,
    fontSize: 13,
    color: colors.textLight,
    textAlign: 'center',
  },
  retry: {
    marginTop: 20,
    alignSelf: 'stretch',
  },
})

export default styles
