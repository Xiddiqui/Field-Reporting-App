import React from 'react'
import { NavigationContainer, DefaultTheme, Theme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import Dashboard from '../screens/dashboard'
import UploadReport from '../screens/uploadReport'
import ReviewScreen from '../features/review/ReviewScreen'
import DevToolsScreen from '../features/devtools/DevToolsScreen'
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
        <Stack.Screen name={ROUTES.UPLOAD_REPORT} component={UploadReport} options={{ title: 'New Report', statusBarStyle: 'dark' }} />
        <Stack.Screen name={ROUTES.REVIEW} component={ReviewScreen} options={{ title: 'Server Reports', statusBarStyle: 'dark' }} />
        {__DEV__ && (
          <Stack.Screen name={ROUTES.DEV_TOOLS} component={DevToolsScreen} options={{ title: 'Failure Simulation (dev)', statusBarStyle: 'dark' }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default AppNavigator
