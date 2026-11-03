import React from 'react'
import { Image, TouchableOpacity } from 'react-native'
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons/static'
import { AppText, AppView, ProgressBar } from '../../components'
import colors from '../../constants/colors'
import { absolutePath } from '../../data/fileStore'
import { retryReport } from '../../delivery/deliveryService'
import { OutboxItem, useDeliveryState, useNow } from '../../hooks/useDelivery'
import { describeOutboxStatus, StatusTone } from './outboxStatus'
import styles from './style'

const TONE_COLORS: Record<StatusTone, string> = {
  neutral: colors.primary,
  progress: colors.primary,
  warning: colors.warning,
  error: colors.error,
  success: colors.success,
}

const TONE_ICONS: Record<StatusTone, React.ComponentProps<typeof MaterialDesignIcons>['name']> = {
  neutral: 'content-save-outline',
  progress: 'cloud-upload-outline',
  warning: 'cloud-clock-outline',
  error: 'alert-circle-outline',
  success: 'cloud-check-outline',
}

const OutboxRow = ({ item }: { item: OutboxItem }) => {
  const { isOnline, progress } = useDeliveryState()
  const now = useNow(1000)
  const { report, images } = item
  const status = describeOutboxStatus(
    {
      status: report.status,
      imageStatuses: images.map(image => image.status),
      lastErrorMessage: report.lastErrorMessage,
      nextAttemptAt: report.nextAttemptAt,
      serverReportId: report.serverReportId,
    },
    isOnline,
    progress[report.clientReportId],
    now,
  )
  const color = TONE_COLORS[status.tone]
  const first = images[0]
  const preview = first?.fileName ? `file://${absolutePath(first.fileName)}` : first?.remoteUrl

  return (
    <AppView style={styles.item}>
      <AppView row style={styles.itemHeader}>
        {preview ? (
          <Image source={{ uri: preview }} style={styles.thumbnail} />
        ) : (
          <AppView center style={styles.thumbnail}>
            <MaterialDesignIcons name="image-outline" size={22} color={colors.textLight} />
          </AppView>
        )}
        <AppView flex>
          <AppText numberOfLines={1} style={styles.description}>{report.description}</AppText>
          <AppText style={styles.meta}>
            {report.imageCount} photo{report.imageCount === 1 ? '' : 's'} · {new Date(report.createdAt).toLocaleString()}
          </AppText>
          <AppView row style={styles.statusRow}>
            <MaterialDesignIcons name={TONE_ICONS[status.tone]} size={16} color={color} />
            <AppText style={[styles.statusLabel, { color }]}>{status.label}</AppText>
          </AppView>
          <AppText style={[styles.detail, status.tone === 'error' && styles.detailError]} numberOfLines={3}>
            {status.detail}
          </AppText>
        </AppView>
      </AppView>
      {status.progress !== null && <ProgressBar progress={status.progress} color={color} style={styles.progress} />}
      {status.canRetry && (
        <TouchableOpacity
          style={styles.retry}
          onPress={() => retryReport(report.clientReportId)}
          accessibilityRole="button"
          accessibilityLabel="Retry this upload now"
        >
          <MaterialDesignIcons name="refresh" size={16} color={colors.primary} />
          <AppText style={styles.retryText}>Retry now</AppText>
        </TouchableOpacity>
      )}
    </AppView>
  )
}

const Outbox = ({ items }: { items: OutboxItem[] }) => (
  <AppView style={styles.container}>
    {items.map(item => <OutboxRow key={item.report.id} item={item} />)}
  </AppView>
)

export default Outbox
