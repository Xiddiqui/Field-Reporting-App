import React from 'react'
import { ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons/static'
import { TouchableOpacity } from 'react-native'
import { AppButton, AppContainer, AppText, AppView, NetworkBanner } from '../../components'
import { useDeliveryState, useOutbox } from '../../hooks/useDelivery'
import Outbox from '../../features/outbox/Outbox'
import { confirmResetLocalData } from '../../features/reset/resetLocalData'
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
  const items = useOutbox()
  const { isOnline, isRunning } = useDeliveryState()

  const count = (predicate: (status: string) => boolean) => items.filter(item => predicate(item.report.status)).length
  const waitingCount = count(status => status !== 'uploaded' && status !== 'needs_attention')
  const attentionCount = count(status => status === 'needs_attention')
  const uploadedCount = count(status => status === 'uploaded')
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
              {isOnline ? (isRunning ? 'Network available · uploading' : 'Network available') : 'No network'}
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
                  Add a description and photos. Reports are saved on this device first and upload automatically.
                </AppText>
              </AppView>
            </AppView>
            <AppButton title="New report" onPress={() => navigation.navigate(ROUTES.UPLOAD_REPORT)} />
          </AppView>

          <AppView row style={styles.linksRow}>
            <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate(ROUTES.REVIEW)} accessibilityRole="button">
              <MaterialDesignIcons name="cloud-search-outline" size={20} color={colors.primary} />
              <AppText style={styles.linkText}>Server reports</AppText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkButton} onPress={confirmResetLocalData} accessibilityRole="button">
              <MaterialDesignIcons name="delete-sweep-outline" size={20} color={colors.error} />
              <AppText style={[styles.linkText, { color: colors.error }]}>Reset local data</AppText>
            </TouchableOpacity>
          </AppView>
          {__DEV__ && (
            <TouchableOpacity style={styles.devLink} onPress={() => navigation.navigate(ROUTES.DEV_TOOLS)} accessibilityRole="button">
              <AppText style={styles.devLinkText}>Dev: failure simulation</AppText>
            </TouchableOpacity>
          )}

          <AppText style={styles.sectionTitle}>Overview</AppText>
          <AppView row style={styles.statsRow}>
            <StatCard icon="clock-outline" label="Waiting" value={waitingCount} color={colors.primary} />
            <StatCard icon="alert-circle-outline" label="Attention" value={attentionCount} color={colors.error} />
            <StatCard icon="cloud-check-outline" label="Uploaded" value={uploadedCount} color={colors.success} />
          </AppView>

          <AppText style={styles.sectionTitle}>Outbox (this device)</AppText>
          {items.length === 0 ? (
            <AppView center style={styles.emptyState}>
              <MaterialDesignIcons name="tray" size={36} color={colors.textLight} />
              <AppText style={styles.emptyTitle}>Outbox is empty</AppText>
              <AppText style={styles.emptyText}>Reports you save appear here with their upload state.</AppText>
            </AppView>
          ) : (
            <Outbox items={items} />
          )}
        </AppView>
      </ScrollView>
    </AppContainer>
  )
}

export default Dashboard
