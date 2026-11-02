import { Modal, Pressable, TouchableOpacity } from 'react-native'
import React from 'react'
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons/static'
import AppText from '../AppText'
import AppView from '../AppView'
import colors from '../../constants/colors'
import styles from './style'

type ImagePickerModalProps = {
  visible: boolean
  onClose: () => void
  onCamera: () => void
  onGallery: () => void
}

const ImagePickerModal = ({ visible, onClose, onCamera, onGallery }: ImagePickerModalProps) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <AppText style={styles.title}>Add Photos</AppText>
          <AppView row style={styles.options}>
            <TouchableOpacity style={styles.option} activeOpacity={0.8} onPress={onCamera}>
              <AppView center style={styles.iconWrapper}>
                <MaterialDesignIcons name="camera" size={32} color={colors.primary} />
              </AppView>
              <AppText style={styles.optionText}>Camera</AppText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.option} activeOpacity={0.8} onPress={onGallery}>
              <AppView center style={styles.iconWrapper}>
                <MaterialDesignIcons name="image-multiple" size={32} color={colors.primary} />
              </AppView>
              <AppText style={styles.optionText}>Gallery</AppText>
            </TouchableOpacity>
          </AppView>
          <TouchableOpacity onPress={onClose} style={styles.cancel}>
            <AppText style={styles.cancelText}>Cancel</AppText>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

export default ImagePickerModal
