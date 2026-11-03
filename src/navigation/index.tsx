import React from 'react'
import { NavigationContainer, DefaultTheme, Theme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import Dashboard from '../screens/dashboard'
import UploadReport from '../screens/uploadReport'
import colors from '../constants/colors'
import { RootStackParamList, ROUTES } from './types'

const Stack = createNativeStackNavigator<RootStackParamList>()

const theme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.secondary,
    card: colors.white,
    text: colors.text,
    border: colors.border,
  },
}

const AppNavigator = () => {
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        initialRouteName={ROUTES.DASHBOARD}
        screenOptions={{
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text, fontWeight: '600' },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name={ROUTES.DASHBOARD} component={Dashboard} options={{ headerShown: false, statusBarStyle: 'light' }} />
        <Stack.Screen name={ROUTES.UPLOAD_REPORT} component={UploadReport} options={{ title: 'Upload Report', statusBarStyle: 'dark' }} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default AppNavigator
