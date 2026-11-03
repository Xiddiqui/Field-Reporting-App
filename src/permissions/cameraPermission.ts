import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native'

export type PermissionOutcome = 'granted' | 'denied' | 'blocked'

// Android needs CAMERA at runtime because the manifest declares it. The gallery uses the system
// photo picker, which needs no runtime permission. On iOS the picker shows the system prompt
// itself and reports a 'permission' error, handled by the caller.
export const requestCameraPermission = async (): Promise<PermissionOutcome> => {
  if (Platform.OS !== 'android') {
    return 'granted'
  }
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA)
  if (result === PermissionsAndroid.RESULTS.GRANTED) {
    return 'granted'
  }
  return result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'blocked' : 'denied'
}

export const isCameraPermissionGranted = async () =>
  Platform.OS !== 'android' || PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA)

export const explainCameraPermission = (outcome: Exclude<PermissionOutcome, 'granted'>, onOpenSettings: () => void) => {
  if (outcome === 'denied') {
    Alert.alert('Camera access needed', 'Allow camera access to take photos for this report. You can still add photos from the gallery.')
    return
  }
  Alert.alert(
    'Camera access is turned off',
    'Camera access was denied permanently. Turn it on in Settings, then come back — no restart needed.',
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          onOpenSettings()
          Linking.openSettings()
        },
      },
    ],
  )
}
