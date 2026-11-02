import { StyleSheet } from 'react-native'
import colors from '../../constants/colors'

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    padding: 20,
    paddingBottom: 32,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.white,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  options: {
    justifyContent: 'space-evenly',
  },
  option: {
    alignItems: 'center',
  },
  iconWrapper: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginBottom: 8,
    backgroundColor: colors.secondaryLight,
  },
  optionText: {
    fontWeight: '600',
  },
  cancel: {
    marginTop: 24,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: colors.error,
  },
})

export default styles
