import { Alert } from 'react-native'
import { deleteUnreferencedFiles } from '../../data/fileStore'
import { deleteAllLocalReports, getQueueSummary, referencedFiles, ResetBlockedError } from '../../data/reportRepository'
import { pauseDelivery, resumeDelivery } from '../../delivery/deliveryService'

// Reset scope (see README "Reset"): deletes this device's outbox rows and their photo files.
// It never deletes anything on the server, and refuses to run while a report is uploading or
// its photos are being prepared.

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

const performReset = async () => {
  pauseDelivery()
  try {
    try {
      await deleteAllLocalReports()
    } catch (error) {
      const message = error instanceof ResetBlockedError ? error.message : `${error instanceof Error ? error.message : 'Unknown error'}`
      Alert.alert('Reset not completed', `${message}\n\nNothing was deleted.`)
      return
    }
    try {
      await deleteUnreferencedFiles(await referencedFiles())
    } catch {
      Alert.alert('Reset completed with a warning', 'The outbox was cleared, but some photo files could not be removed yet. They will be cleaned up the next time the app starts.')
      return
    }
    Alert.alert('Local data cleared', 'The outbox on this device is empty. Reports already on the server are unchanged and still appear in Review.')
  } finally {
    resumeDelivery()
  }
}

export const confirmResetLocalData = async () => {
  const summary = await getQueueSummary()
  if (summary.total === 0) {
    Alert.alert('Nothing to reset', 'There are no reports stored on this device. Reports on the server are not affected by Reset.')
    return
  }
  if (summary.uploading > 0 || summary.preparing > 0) {
    Alert.alert(
      'Reset not available right now',
      'A report is uploading or its photos are being prepared. Wait until it finishes, then try again. Nothing was deleted.',
    )
    return
  }

  const lines = []
  if (summary.notUploaded > 0) {
    lines.push(`⚠️ ${plural(summary.notUploaded, 'report')} have NOT reached the server. They and their photos will be permanently discarded from this device.`)
  }
  if (summary.uploaded > 0) {
    lines.push(`${plural(summary.uploaded, 'uploaded report')} will be removed from this device's outbox only.`)
  }
  lines.push('Nothing is deleted from the server: uploaded reports stay visible in Review.')

  Alert.alert('Reset local data?', lines.join('\n\n'), [
    { text: 'Cancel', style: 'cancel' },
    {
      text: summary.notUploaded > 0 ? `Discard ${summary.notUploaded} & reset` : 'Reset',
      style: 'destructive',
      onPress: performReset,
    },
  ])
}
