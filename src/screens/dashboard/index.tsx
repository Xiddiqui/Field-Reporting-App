import React from 'react'
import { ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons/static'
import { AppButton, AppContainer, AppText, AppView, NetworkBanner, PendingUploads } from '../../components'
import { usePendingReports, useUploadQueue } from '../../hooks/useUploadQueue'
import { RootStackScreenProps, ROUTES } from '../../navigation/types'
import colors from '../../constants/colors'
import styles from './style'

type StatCardProps = {
  icon: React.ComponentProps<typeof MaterialDesignIcons>['name']
  label: string
  value: string | number
  color: string
}

const StatCard = ({ icon, label, value, color }: StatCardProps) => (
  <AppView flex style={styles.statCard}>
    <AppView center style={[styles.statIcon, { backgroundColor: `${color}1A` }]}>
      <MaterialDesignIcons name={icon} size={20} color={color} />
    </AppView>
    <AppText style={styles.statValue}>{value}</AppText>
    <AppText style={styles.statLabel}>{label}</AppText>
  </AppView>
)

const Dashboard = ({ navigation }: RootStackScreenProps<typeof ROUTES.DASHBOARD>) => {
  const insets = useSafeAreaInsets()
  const reports = usePendingReports()
  const { isOnline, isSyncing } = useUploadQueue()

  const pendingCount = reports.filter(report => report.status === 'pending').length
  const failedCount = reports.filter(report => report.status === 'failed').length
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <AppContainer edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AppView style={[styles.header, { paddingTop: insets.top + 24 }]}>
          <AppView row style={styles.headerTop}>
            <AppView flex>
              <AppText style={styles.date}>{today}</AppText>
              <AppText style={styles.welcome}>Welcome</AppText>
              <AppText style={styles.subtitle}>Capture and submit your field reports</AppText>
            </AppView>
            <AppView center style={styles.avatar}>
              <MaterialDesignIcons name="clipboard-text-outline" size={26} color={colors.white} />
            </AppView>
          </AppView>

          <AppView row style={styles.connection}>
            <AppView style={[styles.dot, { backgroundColor: isOnline ? colors.success : colors.warning }]} />
            <AppText style={styles.connectionText}>
              {isOnline ? (isSyncing ? 'Online · Syncing' : 'Online') : 'Offline mode'}
            </AppText>
          </AppView>
        </AppView>

        <AppView style={styles.body}>
          <NetworkBanner />

          <AppView style={styles.actionCard}>
            <AppView row style={styles.actionHeader}>
              <AppView center style={styles.actionIcon}>
                <MaterialDesignIcons name="file-document-edit-outline" size={28} color={colors.primary} />
              </AppView>
              <AppView flex>
                <AppText style={styles.actionTitle}>New Field Report</AppText>
                <AppText style={styles.actionText}>
                  Add a description and photos. Reports are saved offline and sync automatically.
                </AppText>
              </AppView>
            </AppView>
            <AppButton title="Upload Report" onPress={() => navigation.navigate(ROUTES.UPLOAD_REPORT)} />
          </AppView>

          <AppText style={styles.sectionTitle}>Overview</AppText>
          <AppView row style={styles.statsRow}>
            <StatCard icon="clock-outline" label="Pending" value={pendingCount} color={colors.primary} />
            <StatCard icon="alert-circle-outline" label="Failed" value={failedCount} color={colors.error} />
            <StatCard
              icon={isOnline ? 'cloud-check-outline' : 'cloud-off-outline'}
              label="Status"
              value={isOnline ? 'Online' : 'Offline'}
              color={isOnline ? colors.success : colors.warning}
            />
          </AppView>

          {reports.length === 0 ? (
            <AppView center style={styles.emptyState}>
              <MaterialDesignIcons name="check-circle-outline" size={36} color={colors.success} />
              <AppText style={styles.emptyTitle}>All caught up</AppText>
              <AppText style={styles.emptyText}>Every report has been uploaded.</AppText>
            </AppView>
          ) : (
            <PendingUploads />
          )}
        </AppView>
      </ScrollView>
    </AppContainer>
  )
}

export default Dashboard
