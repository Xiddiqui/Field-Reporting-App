import React, { useSyncExternalStore } from 'react'
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { AppText, AppView } from '../../components'
import colors from '../../constants/colors'
import {
  FAILURE_MODES,
  FailureTarget,
  getFailureConfig,
  setFailureConfig,
  subscribeFailureConfig,
} from '../../api/failureSimulation'

// DEVELOPMENT ONLY: this screen is registered only when __DEV__ is true.

const TARGETS: { target: FailureTarget; label: string }[] = [
  { target: 'any', label: 'Any request' },
  { target: 'uploadImage', label: 'Image upload' },
  { target: 'createOrResolveReport', label: 'Finalize report' },
  { target: 'listReports', label: 'Review fetch' },
]

const COUNTS: { remaining: number | null; label: string }[] = [
  { remaining: 1, label: 'Next request' },
  { remaining: 2, label: 'Next 2 requests' },
  { remaining: null, label: 'Every request' },
]

const LATENCIES = [1000, 3000, 10000]

const Chip = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.chip, selected && styles.chipSelected]}
    accessibilityRole="radio"
    accessibilityState={{ selected }}
  >
    <AppText style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</AppText>
  </TouchableOpacity>
)

const DevToolsScreen = () => {
  const config = useSyncExternalStore(subscribeFailureConfig, getFailureConfig)

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <AppText style={styles.warning}>
        Development only. Injects failures into requests made by this app to test retries and idempotency. Not included in release builds.
      </AppText>

      <AppText style={styles.heading}>Failure</AppText>
      <AppView row style={styles.wrap}>
        {FAILURE_MODES.map(({ mode, label }) => (
          <Chip key={mode} label={label} selected={config.mode === mode} onPress={() => setFailureConfig({ mode, remaining: config.remaining === 0 ? 1 : config.remaining })} />
        ))}
      </AppView>

      <AppText style={styles.heading}>Applies to</AppText>
      <AppView row style={styles.wrap}>
        {TARGETS.map(({ target, label }) => (
          <Chip key={target} label={label} selected={config.target === target} onPress={() => setFailureConfig({ target })} />
        ))}
      </AppView>

      <AppText style={styles.heading}>How many</AppText>
      <AppView row style={styles.wrap}>
        {COUNTS.map(({ remaining, label }) => (
          <Chip key={label} label={label} selected={config.remaining === remaining} onPress={() => setFailureConfig({ remaining })} />
        ))}
      </AppView>

      <AppText style={styles.heading}>Latency (for "Added latency")</AppText>
      <AppView row style={styles.wrap}>
        {LATENCIES.map(latencyMs => (
          <Chip key={latencyMs} label={`${latencyMs / 1000}s`} selected={config.latencyMs === latencyMs} onPress={() => setFailureConfig({ latencyMs })} />
        ))}
      </AppView>

      <AppText style={styles.status}>
        Active: {config.mode === 'off' ? 'off' : `${config.mode} · ${config.target} · ${config.remaining === null ? 'every request' : `${config.remaining} left`}`}
      </AppText>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  warning: { padding: 12, borderRadius: 8, backgroundColor: '#FFF4E5', color: colors.warning, fontSize: 13 },
  heading: { marginTop: 20, marginBottom: 8, fontWeight: '700' },
  wrap: { flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text },
  chipTextSelected: { color: colors.white, fontWeight: '600' },
  status: { marginTop: 24, fontSize: 13, color: colors.textLight },
})

export default DevToolsScreen
