import React, { useEffect, useRef, useState } from 'react'
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons/static'
import AppText from '../AppText'
import AppView from '../AppView'
import colors from '../../constants/colors'
import { useDeliveryState } from '../../hooks/useDelivery'
import styles from './style'

const BACK_ONLINE_DURATION = 3000

const NetworkBanner = () => {
  const { isOnline } = useDeliveryState()
  const [showBackOnline, setShowBackOnline] = useState(false)
  const wasOnline = useRef(isOnline)

  useEffect(() => {
    if (isOnline && !wasOnline.current) {
      setShowBackOnline(true)
      const timer = setTimeout(() => setShowBackOnline(false), BACK_ONLINE_DURATION)
      wasOnline.current = isOnline
      return () => clearTimeout(timer)
    }
    wasOnline.current = isOnline
    if (!isOnline) {
      setShowBackOnline(false)
    }
  }, [isOnline])

  if (isOnline && !showBackOnline) {
    return null
  }

  return (
    <AppView row style={[styles.banner, isOnline ? styles.online : styles.offline]}>
      <MaterialDesignIcons name={isOnline ? 'wifi' : 'wifi-off'} size={18} color={colors.white} />
      <AppText style={styles.text}>
        {isOnline ? 'Network is back — resuming uploads' : 'No network. Reports are saved on this device and upload when connected.'}
      </AppText>
    </AppView>
  )
}

export default NetworkBanner
