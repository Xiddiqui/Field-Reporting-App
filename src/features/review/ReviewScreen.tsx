import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Image, RefreshControl, ScrollView, TouchableOpacity } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons/static'
import { AppButton, AppContainer, AppText, AppView } from '../../components'
import colors from '../../constants/colors'
import { normalizeError } from '../../api/apiErrors'
import { reportApi } from '../../delivery/deliveryService'
import type { ServerReport } from '../../delivery/deliveryTypes'
import { startRequest } from '../../delivery/requestTimeout'
import { RootStackScreenProps, ROUTES } from '../../navigation/types'
import styles from './style'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'loaded'; reports: ServerReport[]; fetchedAt: number }
  | { kind: 'error'; message: string }

const FETCH_TIMEOUT_MS = 20_000

const formatBytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`

const ReportCard = ({ report }: { report: ServerReport }) => (
  <AppView style={styles.card}>
    <AppText style={styles.description}>{report.description}</AppText>
    <AppText style={styles.meta} selectable>Server ID: {report.id}</AppText>
    <AppText style={styles.meta}>Created on server: {new Date(report.createdAt).toLocaleString()}</AppText>
    <AppText style={styles.meta}>
      {report.imageCount} photo{report.imageCount === 1 ? '' : 's'} · largest {formatBytes(Math.max(...report.images.map(image => image.sizeBytes), 0))}
    </AppText>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.images}>
      {report.images.map(image => (
        image.url ? (
          <Image key={image.imageId} source={{ uri: image.url }} style={styles.image} accessibilityLabel="Report photo from server" />
        ) : (
          <AppView key={image.imageId} center style={styles.image}>
            <MaterialDesignIcons name="image-off-outline" size={20} color={colors.textLight} />
          </AppView>
        )
      ))}
    </ScrollView>
  </AppView>
)

const RefreshButton = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel="Refresh server reports">
    <MaterialDesignIcons name="refresh" size={24} color={colors.primary} />
  </TouchableOpacity>
)

// Renders only what the server returns. Local outbox reports are never merged in.
const ReviewScreen = ({ navigation }: RootStackScreenProps<typeof ROUTES.REVIEW>) => {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (asRefresh: boolean) => {
    if (asRefresh) {
      setRefreshing(true)
    } else {
      setState({ kind: 'loading' })
    }
    try {
      const reports = await startRequest(ctx => reportApi.listReports(ctx), FETCH_TIMEOUT_MS).promise
      setState({ kind: 'loaded', reports, fetchedAt: Date.now() })
    } catch (error) {
      setState({ kind: 'error', message: normalizeError(error).message })
    } finally {
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(useCallback(() => {
    load(false)
  }, [load]))

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => <RefreshButton onPress={() => load(true)} />,
    })
  }, [navigation, load])

  if (state.kind === 'loading') {
    return (
      <AppContainer edges={['bottom', 'left', 'right']}>
        <AppView flex center>
          <ActivityIndicator color={colors.primary} />
          <AppText style={styles.stateText}>Loading reports from the server…</AppText>
        </AppView>
      </AppContainer>
    )
  }

  if (state.kind === 'error') {
    return (
      <AppContainer edges={['bottom', 'left', 'right']}>
        <AppView flex center style={styles.statePadding}>
          <MaterialDesignIcons name="cloud-alert-outline" size={40} color={colors.error} />
          <AppText style={styles.stateTitle}>Could not load server reports</AppText>
          <AppText style={styles.stateText}>{state.message}</AppText>
          <AppText style={styles.stateText}>This is a connection problem, not an empty list.</AppText>
          <AppButton title="Try again" onPress={() => load(false)} style={styles.retry} />
        </AppView>
      </AppContainer>
    )
  }

  return (
    <AppContainer edges={['bottom', 'left', 'right']}>
      <FlatList
        data={state.reports}
        keyExtractor={report => report.id}
        renderItem={({ item }) => <ReportCard report={item} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListHeaderComponent={
          <AppText style={styles.note}>
            Reports stored on the server, fetched {new Date(state.fetchedAt).toLocaleTimeString()}. Reports still in this device's outbox are not shown here until the server has them.
          </AppText>
        }
        ListEmptyComponent={
          <AppView center style={styles.statePadding}>
            <MaterialDesignIcons name="tray-remove" size={40} color={colors.textLight} />
            <AppText style={styles.stateTitle}>No reports on the server yet</AppText>
            <AppText style={styles.stateText}>The server responded and holds no reports.</AppText>
          </AppView>
        }
      />
    </AppContainer>
  )
}

export default ReviewScreen
