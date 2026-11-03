import type { NativeStackScreenProps } from '@react-navigation/native-stack'

export const ROUTES = {
  DASHBOARD: 'Dashboard',
  UPLOAD_REPORT: 'UploadReport',
} as const

export type RootStackParamList = {
  [ROUTES.DASHBOARD]: undefined
  [ROUTES.UPLOAD_REPORT]: undefined
}

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>
