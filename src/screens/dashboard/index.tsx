import React, { useState } from 'react'
import { Alert, Image, Linking, PermissionsAndroid, Platform, ScrollView, TouchableOpacity } from 'react-native'
import { Asset, ImagePickerResponse, launchCamera, launchImageLibrary } from 'react-native-image-picker'
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons/static'
import { AppButton, AppContainer, AppText, AppTextInput, AppView, ImagePickerModal, NetworkBanner, PendingUploads } from '../../components'
import { MAX_IMAGES, saveReportOffline } from '../../services/reportService'
import { getUploadQueueState, processQueue } from '../../services/uploadQueue'
import colors from '../../constants/colors'
import styles from './style'

const Dashboard = () => {
    const [description, setDescription] = useState('')
    const [images, setImages] = useState<Asset[]>([])
    const [pickerVisible, setPickerVisible] = useState(false)
    // True only while images are compressed and saved to the offline queue
    const [uploading, setUploading] = useState(false)

    const remaining = MAX_IMAGES - images.length

    const handlePickerResponse = (response: ImagePickerResponse) => {
        if (response.didCancel) {
            return
        }
        if (response.errorCode) {
            Alert.alert('Error', response.errorMessage ?? 'Unable to pick image')
            return
        }
        const assets = (response.assets ?? []).filter(asset => !!asset.uri)
        setImages(prev => [...prev, ...assets].slice(0, MAX_IMAGES))
    }

    // CAMERA is declared in the manifest, so Android requires it granted at runtime before launching the camera
    const requestCameraPermission = async () => {
        if (Platform.OS !== 'android') {
            return true
        }
        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA)
        if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
            Alert.alert('Camera permission', 'Please enable camera access in Settings to take photos.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ])
        }
        return result === PermissionsAndroid.RESULTS.GRANTED
    }

    const onCamera = async () => {
        setPickerVisible(false)
        if (!(await requestCameraPermission())) {
            return
        }
        handlePickerResponse(await launchCamera({ mediaType: 'photo', saveToPhotos: false }))
    }

    const onGallery = async () => {
        setPickerVisible(false)
        handlePickerResponse(await launchImageLibrary({ mediaType: 'photo', selectionLimit: remaining }))
    }

    const onAddImages = () => {
        if (remaining <= 0) {
            Alert.alert('Limit reached', `You can select up to ${MAX_IMAGES} images.`)
            return
        }
        setPickerVisible(true)
    }

    const onRemoveImage = (uri?: string) => {
        setImages(prev => prev.filter(image => image.uri !== uri))
    }

    const onUploadReport = async () => {
        if (!description.trim()) {
            Alert.alert('Missing description', 'Please enter a description for the report.')
            return
        }
        if (images.length === 0) {
            Alert.alert('No images', 'Please add at least one image.')
            return
        }

        try {
            setUploading(true)
            await saveReportOffline(description, images)
            setDescription('')
            setImages([])
            processQueue()
            if (!getUploadQueueState().isOnline) {
                Alert.alert('Saved offline', 'No internet connection. The report will upload automatically when you are back online.')
            }
        } catch (error) {
            Alert.alert('Save failed', error instanceof Error ? error.message : 'Something went wrong')
        } finally {
            setUploading(false)
        }
    }

    return (
        <AppContainer>
            <NetworkBanner />
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <AppText style={styles.heading}>New Field Report</AppText>

                <AppTextInput
                    label="Description"
                    placeholder="Describe what you observed..."
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    editable={!uploading}
                />

                <AppText style={styles.imagesLabel}>
                    Images ({images.length}/{MAX_IMAGES})
                </AppText>
                <AppView row style={styles.imageGrid}>
                    {images.map(image => (
                        <AppView key={image.uri} style={styles.imageWrapper}>
                            <Image source={{ uri: image.uri }} style={styles.image} />
                            {!uploading && (
                                <TouchableOpacity style={styles.removeButton} onPress={() => onRemoveImage(image.uri)}>
                                    <MaterialDesignIcons name="close" size={16} color={colors.white} />
                                </TouchableOpacity>
                            )}
                        </AppView>
                    ))}
                    {remaining > 0 && !uploading && (
                        <TouchableOpacity style={[styles.imageWrapper, styles.addImage]} onPress={onAddImages}>
                            <MaterialDesignIcons name="camera-plus" size={28} color={colors.primary} />
                        </TouchableOpacity>
                    )}
                </AppView>

                <AppButton
                    title="Upload Report"
                    onPress={onUploadReport}
                    loading={uploading}
                    style={styles.uploadButton}
                />

                <PendingUploads />
            </ScrollView>

            <ImagePickerModal
                visible={pickerVisible}
                onClose={() => setPickerVisible(false)}
                onCamera={onCamera}
                onGallery={onGallery}
            />
        </AppContainer>
    )
}

export default Dashboard
