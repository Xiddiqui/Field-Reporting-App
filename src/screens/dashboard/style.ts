import { StyleSheet } from 'react-native'
import colors from '../../constants/colors'

const cardShadow = {
  shadowColor: colors.primaryDark,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 32,
    backgroundColor: colors.secondaryLight,
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 56,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: {
    alignItems: 'flex-start',
    gap: 12,
  },
  date: {
    fontSize: 13,
    color: colors.border,
  },
  welcome: {
    marginTop: 4,
    fontSize: 30,
    fontWeight: '700',
    color: colors.white,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: colors.secondaryLight,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  connection: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },
  body: {
    marginTop: -36,
    paddingHorizontal: 16,
  },
  actionCard: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: colors.white,
    ...cardShadow,
  },
  actionHeader: {
    gap: 14,
    marginBottom: 18,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.secondaryLight,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  actionText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textLight,
  },
  sectionTitle: {
    marginTop: 28,
    marginBottom: 12,
    fontSize: 16,
    fontWeight: '700',
  },
  statsRow: {
    gap: 12,
  },
  statCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.white,
    ...cardShadow,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    marginBottom: 10,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textLight,
  },
  emptyState: {
    marginTop: 20,
    padding: 24,
    borderRadius: 16,
    backgroundColor: colors.white,
    ...cardShadow,
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyText: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textLight,
  },
  linksRow: {
    gap: 10,
    marginTop: 14,
  },
  linkButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  devLink: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  devLinkText: {
    fontSize: 12,
    color: colors.warning,
    textDecorationLine: 'underline',
  },
})

export default styles
